import { useMemo, useRef, Suspense } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { Group } from "three";
import { useGameStore } from "../../../application/store/useGameStore";
import { BUILDING_DEFINITIONS } from "../../../domain/config/buildings";
import { BuildingService } from "../../../domain/services/BuildingService";
import { HexPathfindingService } from "../../../domain/services/HexPathfindingService";
import { worldToHex, hexToWorld } from "../../generator/hex/HexMath";
import { useTerrainHeight } from "./TerrainHeightContext";
import type { PlacedBuilding } from "../../../domain/entities/Building";
import type { ResourceNode } from "../../../domain/mapEditorTypes";

const ROVER_MODEL = "/models/mars/rover.glb";
const DRONE_MODEL = "/models/mars/craft_miner.glb";

useGLTF.preload(ROVER_MODEL);
useGLTF.preload(DRONE_MODEL);

// ── Rover 3D Model ───────────────────────────────────────────────────────────

function RoverModel() {
    const gltf = useGLTF(ROVER_MODEL) as { scene: Group };
    const clone = useMemo(() => {
        const c = gltf.scene.clone(true);
        const box = new THREE.Box3().setFromObject(c);
        const center = box.getCenter(new THREE.Vector3());
        c.position.set(-center.x, -box.min.y, -center.z);
        c.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
            }
        });
        return c;
    }, [gltf.scene]);

    return <primitive object={clone} scale={1.8} />;
}

// ── Drone 3D Model ───────────────────────────────────────────────────────────

function DroneModel() {
    const gltf = useGLTF(DRONE_MODEL) as { scene: Group };
    const clone = useMemo(() => {
        const c = gltf.scene.clone(true);
        const box = new THREE.Box3().setFromObject(c);
        const center = box.getCenter(new THREE.Vector3());
        c.position.set(-center.x, -box.min.y, -center.z);
        c.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = true;
                const mat = mesh.material as THREE.MeshStandardMaterial;
                if (mat) {
                    mat.emissive = new THREE.Color("#00e5ff");
                    mat.emissiveIntensity = 0.25;
                }
            }
        });
        return c;
    }, [gltf.scene]);

    return <primitive object={clone} scale={1.8} />;
}

// ── Logistics Rover Component (Level 2) ──────────────────────────────────────

interface LogisticsRoverProps {
    building: PlacedBuilding;
    depositNode: ResourceNode;
}

function LogisticsRover({ building, depositNode }: LogisticsRoverProps) {
    const groupRef = useRef<THREE.Group>(null);
    const getTerrainY = useTerrainHeight();
    const hexGrid = useGameStore((state) => state.hexGrid);

    // Compute A* path in world coordinates
    const waypoints = useMemo(() => {
        const [startQ, startR] = worldToHex(building.position.x, building.position.z);
        const [targetQ, targetR] = depositNode.pos;

        let pathCoords: [number, number][] = [];
        if (hexGrid) {
            const found = HexPathfindingService.findPath(hexGrid, [startQ, startR], [targetQ, targetR]);
            if (found && found.length > 0) {
                pathCoords = found;
            }
        }

        if (pathCoords.length === 0) {
            pathCoords = [[startQ, startR], [targetQ, targetR]];
        }

        const points = pathCoords.map(([q, r]) => {
            const [wx, wz] = hexToWorld(q, r);
            return new THREE.Vector2(wx, wz);
        });

        // Ensure at least 2 distinct points
        if (points.length === 1) {
            points.push(new THREE.Vector2(points[0].x + 0.5, points[0].y + 0.5));
        }

        // Calculate segment lengths and cumulative distances
        const dists: number[] = [0];
        let total = 0;
        for (let i = 0; i < points.length - 1; i++) {
            const d = points[i].distanceTo(points[i + 1]);
            total += d;
            dists.push(total);
        }

        return { points, dists, totalDistance: Math.max(0.1, total) };
    }, [building.position.x, building.position.z, depositNode.pos, hexGrid]);

    const stateRef = useRef({
        progress: 0,
        direction: 1,
        rotY: 0,
        pauseTimer: 0,
    });

    useFrame(({ clock }, delta) => {
        if (!groupRef.current || waypoints.points.length < 2) return;
        const st = stateRef.current;

        // Handle endpoint pause (loading/unloading)
        if (st.pauseTimer > 0) {
            st.pauseTimer -= delta;
            return;
        }

        const speed = 2.6; // world units per second
        const deltaProgress = (speed * delta) / waypoints.totalDistance;
        st.progress += st.direction * deltaProgress;

        if (st.progress >= 1.0) {
            st.progress = 1.0;
            st.direction = -1;
            st.pauseTimer = 1.2; // 1.2s pause at deposit
        } else if (st.progress <= 0.0) {
            st.progress = 0.0;
            st.direction = 1;
            st.pauseTimer = 1.0; // 1.0s pause at building
        }

        // Find current segment along waypoints
        const currentDist = st.progress * waypoints.totalDistance;
        let segmentIndex = 0;
        while (
            segmentIndex < waypoints.dists.length - 2 &&
            waypoints.dists[segmentIndex + 1] < currentDist
        ) {
            segmentIndex++;
        }

        const segStartDist = waypoints.dists[segmentIndex];
        const segEndDist = waypoints.dists[segmentIndex + 1];
        const segLen = Math.max(0.001, segEndDist - segStartDist);
        const segT = Math.max(0, Math.min(1, (currentDist - segStartDist) / segLen));

        const p0 = waypoints.points[segmentIndex];
        const p1 = waypoints.points[segmentIndex + 1];

        const curX = THREE.MathUtils.lerp(p0.x, p1.x, segT);
        const curZ = THREE.MathUtils.lerp(p0.y, p1.y, segT);
        const curY = getTerrainY(curX, curZ);

        // Heading direction
        const dirX = (p1.x - p0.x) * st.direction;
        const dirZ = (p1.y - p0.y) * st.direction;
        const targetRotY = Math.atan2(dirX, dirZ);

        let angleDiff = targetRotY - st.rotY;
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        st.rotY += angleDiff * Math.min(1, delta * 10);

        // Ground slope pitch
        const sampleDist = 0.35;
        const sampleX = curX + Math.sin(st.rotY) * sampleDist;
        const sampleZ = curZ + Math.cos(st.rotY) * sampleDist;
        const sampleY = getTerrainY(sampleX, sampleZ);
        const pitch = Math.atan2(sampleY - curY, sampleDist);

        const bob = Math.sin(clock.elapsedTime * 12) * 0.02;

        groupRef.current.position.set(curX, curY + 0.12 + bob, curZ);
        groupRef.current.rotation.set(-pitch, st.rotY, 0);
    });

    return (
        <group ref={groupRef}>
            <Suspense fallback={null}>
                <RoverModel />
            </Suspense>
            <pointLight color="#fbbf24" intensity={1.5} distance={5} />
        </group>
    );
}

// ── Logistics Drone Component (Level 3) ──────────────────────────────────────

interface LogisticsDroneProps {
    building: PlacedBuilding;
    depositNode: ResourceNode;
}

function LogisticsDrone({ building, depositNode }: LogisticsDroneProps) {
    const groupRef = useRef<THREE.Group>(null);
    const getTerrainY = useTerrainHeight();

    const [depX, depZ] = useMemo(() => {
        return hexToWorld(depositNode.pos[0], depositNode.pos[1]);
    }, [depositNode.pos]);

    const stateRef = useRef({
        t: 0,
        direction: 1,
        pauseTimer: 0,
        rotY: 0,
        currentPos: new THREE.Vector3(),
    });

    useFrame(({ clock }, delta) => {
        if (!groupRef.current) return;
        const st = stateRef.current;

        if (st.pauseTimer > 0) {
            st.pauseTimer -= delta;
            // Hover animation during pause
            const hoverBob = Math.sin(clock.elapsedTime * 4) * 0.08;
            groupRef.current.position.y = st.currentPos.y + hoverBob;
            return;
        }

        const flightSpeed = 0.35; // progress cycles per sec
        st.t += st.direction * delta * flightSpeed;

        if (st.t >= 1.0) {
            st.t = 1.0;
            st.direction = -1;
            st.pauseTimer = 0.8;
        } else if (st.t <= 0.0) {
            st.t = 0.0;
            st.direction = 1;
            st.pauseTimer = 0.6;
        }

        const bX = building.position.x;
        const bZ = building.position.z;
        const bY = getTerrainY(bX, bZ) + 0.8;
        const dY = getTerrainY(depX, depZ) + 0.8;

        const midX = (bX + depX) / 2;
        const midZ = (bZ + depZ) / 2;
        const midTerrainY = getTerrainY(midX, midZ);
        const cruiseY = Math.max(bY, dY, midTerrainY) + 3.0;

        // Quadratic Bezier interpolation
        const u = st.t;
        const invU = 1 - u;

        const posX = invU * invU * bX + 2 * invU * u * midX + u * u * depX;
        const posY = invU * invU * bY + 2 * invU * u * cruiseY + u * u * dY;
        const posZ = invU * invU * bZ + 2 * invU * u * midZ + u * u * depZ;

        // Velocity vector derivative
        const vx = (2 * (1 - u) * (midX - bX) + 2 * u * (depX - midX)) * st.direction;
        const vy = (2 * (1 - u) * (cruiseY - bY) + 2 * u * (dY - cruiseY)) * st.direction;
        const vz = (2 * (1 - u) * (midZ - bZ) + 2 * u * (depZ - midZ)) * st.direction;

        const targetRotY = Math.atan2(vx, vz);
        let angleDiff = targetRotY - st.rotY;
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        st.rotY += angleDiff * Math.min(1, delta * 8);

        const horizontalSpeed = Math.hypot(vx, vz);
        const pitch = -Math.atan2(vy, Math.max(0.1, horizontalSpeed)) * 0.4 - 0.15;
        const roll = Math.sin(clock.elapsedTime * 3) * 0.05;
        const hover = Math.sin(clock.elapsedTime * 6) * 0.06;

        st.currentPos.set(posX, posY, posZ);
        groupRef.current.position.set(posX, posY + hover, posZ);
        groupRef.current.rotation.set(pitch, st.rotY, roll);
    });

    return (
        <group ref={groupRef}>
            <Suspense fallback={null}>
                <DroneModel />
            </Suspense>
            <pointLight color="#38bdf8" intensity={3} distance={10} />
        </group>
    );
}

// ── Main MiningLogisticsSystem Component ──────────────────────────────────────

export function MiningLogisticsSystem() {
    const placed = useGameStore((state) => state.placed);
    const resourceNodes = useGameStore((state) => state.resourceNodes);

    // Collect upgraded mining/extractive buildings and their assigned target deposits
    const logisticsUnits = useMemo(() => {
        const units: Array<{
            building: PlacedBuilding;
            depositNode: ResourceNode;
            unitType: "rover" | "drone";
        }> = [];

        for (const building of placed) {
            const level = building.level ?? 1;
            if (level < 2) continue;

            const def = BUILDING_DEFINITIONS[building.definitionId];
            if (!def?.extractsDeposit) continue;

            const radius = BuildingService.getExtractionRadius(building, def);
            const efficiency = BuildingService.getDepositEfficiencyAtCell(
                def,
                { x: building.position.x, z: building.position.z },
                resourceNodes,
                radius
            );

            if (efficiency.matchingNodes.length === 0) continue;

            // Pick closest active matching deposit node
            const [bQ, bR] = worldToHex(building.position.x, building.position.z);
            let closestNode = efficiency.matchingNodes[0];
            let minDistance = Infinity;

            for (const node of efficiency.matchingNodes) {
                const dq = node.pos[0] - bQ;
                const dr = node.pos[1] - bR;
                const dist = Math.hypot(dq, dr);
                if (dist < minDistance) {
                    minDistance = dist;
                    closestNode = node;
                }
            }

            units.push({
                building,
                depositNode: closestNode,
                unitType: level >= 3 ? "drone" : "rover",
            });
        }

        return units;
    }, [placed, resourceNodes]);

    return (
        <>
            {logisticsUnits.map(({ building, depositNode, unitType }) => {
                if (unitType === "drone") {
                    return (
                        <LogisticsDrone
                            key={`drone-${building.id}`}
                            building={building}
                            depositNode={depositNode}
                        />
                    );
                }
                return (
                    <LogisticsRover
                        key={`rover-${building.id}`}
                        building={building}
                        depositNode={depositNode}
                    />
                );
            })}
        </>
    );
}
