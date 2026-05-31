import { useRef, useMemo, Suspense, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { Group } from "three";
import { useGameStore } from "../../../application/store/useGameStore";
import { useDebugStore } from "../../../application/store/useDebugStore";
import type { AlienShip, AlienGroundUnit } from "../../../domain/entities/Alien";

const SHIP_MODEL   = "/models/mars/craft_speederA.glb";
const ALIEN_MODEL  = "/models/mars/alien.glb";

useGLTF.preload(SHIP_MODEL);
useGLTF.preload(ALIEN_MODEL);

/** Tracks current world positions of ships so lasers can originate from the correct point. */
const shipPositions = new Map<string, THREE.Vector3>();

// ── Ship model ────────────────────────────────────────────────────────────────

function ShipModel() {
    const gltf = useGLTF(SHIP_MODEL) as { scene: Group };
    const clone = useMemo(() => {
        const c = gltf.scene.clone(true);
        const box = new THREE.Box3().setFromObject(c);
        const center = box.getCenter(new THREE.Vector3());
        c.position.set(-center.x, -box.min.y, -center.z);
        // Gentle nose-down tilt (15°) — ships fly mostly forward, slightly downward
        c.rotation.x = -Math.PI / 12;
        // Very subtle emissive glow
        c.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                const mat = mesh.material as THREE.MeshStandardMaterial;
                if (mat) {
                    mat.emissive = new THREE.Color("#ff4400");
                    mat.emissiveIntensity = 0.15;
                }
            }
        });
        return c;
    }, [gltf.scene]);
    return <primitive object={clone} scale={3} />;
}

// ── Alien model ───────────────────────────────────────────────────────────────

function AlienModel() {
    const gltf = useGLTF(ALIEN_MODEL) as { scene: Group };
    const clone = useMemo(() => {
        const c = gltf.scene.clone(true);
        const box = new THREE.Box3().setFromObject(c);
        const center = box.getCenter(new THREE.Vector3());
        c.position.set(-center.x, -box.min.y, -center.z);
        return c;
    }, [gltf.scene]);
    return <primitive object={clone} scale={2} />;
}

// ── World-space lasers (read from shipPositions every frame) ─────────────────

interface WorldLaserProps {
    shipId: string;
    to: THREE.Vector3;
}

function WorldLaserBeam({ shipId, to }: WorldLaserProps) {
    const line = useMemo(() => {
        const geo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(), new THREE.Vector3(),
        ]);
        const mat = new THREE.LineBasicMaterial({ color: "#ff2200", transparent: true, opacity: 0, linewidth: 3 });
        return new THREE.Line(geo, mat);
    }, []);
    const glowRef = useRef<THREE.Mesh>(null);

    useFrame(({ clock }) => {
        const from = shipPositions.get(shipId);
        if (!from) return;
        const positions = line.geometry.attributes.position;
        positions.setXYZ(0, from.x, from.y, from.z);
        positions.setXYZ(1, to.x, to.y, to.z);
        positions.needsUpdate = true;
        (line.material as THREE.LineBasicMaterial).opacity = 0.85 + Math.sin(clock.elapsedTime * 30) * 0.15;
        if (glowRef.current) {
            glowRef.current.position.copy(from);
            const pulse = 0.5 + Math.sin(clock.elapsedTime * 15) * 0.3;
            glowRef.current.scale.setScalar(pulse);
        }
    });

    return (
        <>
            <primitive object={line} />
            <mesh ref={glowRef}>
                <sphereGeometry args={[0.6, 12, 12]} />
                <meshBasicMaterial color="#ff4400" transparent opacity={0.6} depthWrite={false} />
            </mesh>
        </>
    );
}

interface WorldChargingProps {
    shipId: string;
    to: THREE.Vector3;
    progress: number;
}

function WorldChargingLaser({ shipId, to, progress }: WorldChargingProps) {
    const line = useMemo(() => {
        const geo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(), new THREE.Vector3(),
        ]);
        const mat = new THREE.LineBasicMaterial({ color: "#ffcc00", transparent: true, opacity: 0, linewidth: 2 });
        return new THREE.Line(geo, mat);
    }, []);

    useFrame(({ clock }) => {
        const from = shipPositions.get(shipId);
        if (!from) return;
        const positions = line.geometry.attributes.position;
        positions.setXYZ(0, from.x, from.y, from.z);
        positions.setXYZ(1, to.x, to.y, to.z);
        positions.needsUpdate = true;
        const pulse = Math.sin(clock.elapsedTime * (10 + progress * 20)) * 0.3 + 0.5;
        (line.material as THREE.LineBasicMaterial).opacity = progress * pulse;
    });

    return <primitive object={line} />;
}

// ── Ship visuals ──────────────────────────────────────────────────────────────

interface ShipMeshProps {
    ship: AlienShip;
    targetPos: THREE.Vector3 | null;
}

function ShipMesh({ ship, targetPos }: ShipMeshProps) {
    const groupRef = useRef<THREE.Group>(null);

    useFrame(({ clock }) => {
        if (!groupRef.current) return;
        const t = clock.elapsedTime;

        const px = ship.position.x;
        const pz = ship.position.z;

        // Hover oscillation — lower amplitude and closer to ground
        const hoverY = ship.position.y + Math.sin(t * 1.5) * 0.3 - 8;
        groupRef.current.position.set(px, hoverY, pz);

        // Face toward target when available (nose points at target)
        if (targetPos) {
            const dx = targetPos.x - px;
            const dz = targetPos.z - pz;
            groupRef.current.rotation.y = Math.atan2(dx, dz) + Math.PI;
        } else {
            groupRef.current.rotation.y = t * 0.4;
        }

        // Bank roll during approach
        groupRef.current.rotation.z = ship.phase === "approaching"
            ? Math.sin(t * 1.2) * 0.15
            : 0;

        // Update laser origin to ship nose (3 units forward from center)
        const forward = new THREE.Vector3(0, 0, 1).applyEuler(groupRef.current.rotation);
        const nosePos = groupRef.current.position.clone().add(forward.multiplyScalar(3));
        shipPositions.set(ship.id, nosePos);
    });

    const isFiring = ship.phase === "firing";
    const isCharging = ship.phase === "charging";

    useEffect(() => {
        return () => { shipPositions.delete(ship.id); };
    }, [ship.id]);

    return (
        <group ref={groupRef}>
            <Suspense fallback={
                <mesh>
                    <boxGeometry args={[4, 0.8, 8]} />
                    <meshStandardMaterial color="#334155" emissive="#ff3300" emissiveIntensity={0.4} />
                </mesh>
            }>
                <ShipModel />
            </Suspense>
            <pointLight color="#ff4400" intensity={isFiring ? 15 : isCharging ? 10 : 6} distance={30} />
        </group>
    );
}

// ── Ground unit visuals ───────────────────────────────────────────────────────

function GroundUnitMesh({ unit }: { unit: AlienGroundUnit }) {
    const groupRef = useRef<THREE.Group>(null);
    const prevPos  = useRef({ x: unit.position.x, z: unit.position.z });

    useFrame(({ clock }) => {
        if (!groupRef.current) return;
        const t = clock.elapsedTime;

        // Bob up/down while walking
        const moving =
            Math.abs(unit.position.x - prevPos.current.x) > 0.001 ||
            Math.abs(unit.position.z - prevPos.current.z) > 0.001;

        const bobY = moving ? Math.abs(Math.sin(t * 6)) * 0.2 : 0;
        groupRef.current.position.set(unit.position.x, bobY, unit.position.z);

        // Face movement direction
        const dx = unit.position.x - prevPos.current.x;
        const dz = unit.position.z - prevPos.current.z;
        if (Math.abs(dx) + Math.abs(dz) > 0.001) {
            groupRef.current.rotation.y = Math.atan2(dx, dz);
        }
        prevPos.current = { x: unit.position.x, z: unit.position.z };
    });

    return (
        <group ref={groupRef}>
            <Suspense fallback={
                <mesh>
                    <sphereGeometry args={[0.7, 8, 6]} />
                    <meshStandardMaterial color="#7c3aed" emissive="#4c1d95" emissiveIntensity={0.8} />
                </mesh>
            }>
                <AlienModel />
            </Suspense>
            <pointLight color="#a855f7" intensity={2} distance={8} />
        </group>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AlienInvasion() {
    const alienState  = useGameStore((s) => s.alienState);
    const gameMode    = useGameStore((s) => s.gameMode);
    const placed      = useGameStore((s) => s.placed);
    const debugEnabled = useDebugStore((s) => s.enabled);

    // Show in survival mode OR when debug panel is open (for testing)
    if (gameMode !== "survival" && !debugEnabled) return null;
    if (alienState.wave === 0) return null;
    if (alienState.ships.length === 0 && alienState.groundUnits.length === 0) return null;

    return (
        <>
            {alienState.ships.map((ship) => {
                const target = ship.targetBuildingId
                    ? placed.find((b) => b.id === ship.targetBuildingId)
                    : null;
                const targetPos = target
                    ? new THREE.Vector3(target.position.x, 1, target.position.z)
                    : null;
                return <ShipMesh key={ship.id} ship={ship} targetPos={targetPos} />;
            })}
            {/* Lasers rendered in world space, outside ship groups */}
            {alienState.ships.map((ship) => {
                if (ship.phase !== "firing" && ship.phase !== "charging") return null;
                const target = ship.targetBuildingId
                    ? placed.find((b) => b.id === ship.targetBuildingId)
                    : null;
                if (!target) return null;
                const to = new THREE.Vector3(target.position.x, 1, target.position.z);
                return (
                    <group key={`laser-${ship.id}`}>
                        {ship.phase === "firing" && (
                            <WorldLaserBeam shipId={ship.id} to={to} />
                        )}
                        {ship.phase === "charging" && (
                            <WorldChargingLaser shipId={ship.id} to={to} progress={ship.phaseProgress} />
                        )}
                    </group>
                );
            })}
            {alienState.groundUnits.map((unit) => (
                <GroundUnitMesh key={unit.id} unit={unit} />
            ))}
        </>
    );
}
