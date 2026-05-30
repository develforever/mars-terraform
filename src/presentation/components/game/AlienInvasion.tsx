import { useRef, useMemo, Suspense } from "react";
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

// ── Ship model ────────────────────────────────────────────────────────────────

function ShipModel() {
    const gltf = useGLTF(SHIP_MODEL) as { scene: Group };
    const clone = useMemo(() => {
        const c = gltf.scene.clone(true);
        const box = new THREE.Box3().setFromObject(c);
        const center = box.getCenter(new THREE.Vector3());
        c.position.set(-center.x, -box.min.y, -center.z);
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

// ── Laser beam (world-space line) ─────────────────────────────────────────────

interface LaserBeamProps {
    from: THREE.Vector3;
    to: THREE.Vector3;
    visible: boolean;
}

function LaserBeam({ from, to, visible }: LaserBeamProps) {
    const line = useMemo(() => {
        const geo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(), new THREE.Vector3(),
        ]);
        const mat = new THREE.LineBasicMaterial({
            color: "#ff2200",
            transparent: true,
            opacity: 0,
            linewidth: 2,
        });
        return new THREE.Line(geo, mat);
    }, []);

    useFrame(({ clock }) => {
        const positions = line.geometry.attributes.position;
        positions.setXYZ(0, from.x, from.y, from.z);
        positions.setXYZ(1, to.x, to.y, to.z);
        positions.needsUpdate = true;
        (line.material as THREE.LineBasicMaterial).opacity =
            visible ? 0.85 + Math.sin(clock.elapsedTime * 30) * 0.15 : 0;
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

        // Hover oscillation
        const hoverY = ship.position.y + Math.sin(t * 1.5) * 0.8;
        groupRef.current.position.set(px, hoverY, pz);

        // Face toward target when available
        if (targetPos) {
            const dx = targetPos.x - px;
            const dz = targetPos.z - pz;
            groupRef.current.rotation.y = Math.atan2(dx, dz);
        } else {
            groupRef.current.rotation.y = t * 0.4;
        }

        // Bank roll during approach
        groupRef.current.rotation.z = ship.phase === "approaching"
            ? Math.sin(t * 1.2) * 0.15
            : 0;
    });

    const isFiring = ship.phase === "firing";
    const from = new THREE.Vector3(ship.position.x, ship.position.y, ship.position.z);

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
            <pointLight color="#ff4400" intensity={isFiring ? 8 : 3} distance={20} />
            {isFiring && targetPos && (
                <LaserBeam from={from} to={targetPos} visible={true} />
            )}
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
            {alienState.groundUnits.map((unit) => (
                <GroundUnitMesh key={unit.id} unit={unit} />
            ))}
        </>
    );
}
