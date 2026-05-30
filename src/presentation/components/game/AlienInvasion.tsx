import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGameStore } from "../../../application/store/useGameStore";
import type { AlienShip, AlienGroundUnit } from "../../../domain/entities/Alien";

// ── Ship visuals ─────────────────────────────────────────────────────────────

function ShipMesh({ ship }: { ship: AlienShip }) {
    const groupRef = useRef<THREE.Group>(null);

    const laser = useMemo(() => {
        const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -65, 0)];
        const geo  = new THREE.BufferGeometry().setFromPoints(pts);
        const mat  = new THREE.LineBasicMaterial({ color: "#ff0000", transparent: true, opacity: 0 });
        return new THREE.Line(geo, mat);
    }, []);

    useFrame(({ clock }) => {
        if (!groupRef.current) return;
        groupRef.current.position.set(ship.position.x, ship.position.y, ship.position.z);
        groupRef.current.rotation.y = clock.elapsedTime * 0.5;

        const isFiring = ship.phase === "firing" || ship.phase === "targeting";
        (laser.material as THREE.LineBasicMaterial).opacity =
            isFiring ? 0.9 + Math.sin(clock.elapsedTime * 20) * 0.1 : 0;
    });

    return (
        <group ref={groupRef}>
            {/* Fuselage */}
            <mesh>
                <boxGeometry args={[4, 0.8, 8]} />
                <meshStandardMaterial color="#334155" emissive="#1e293b" emissiveIntensity={0.5} />
            </mesh>
            {/* Wings */}
            <mesh position={[4, 0, 0]}>
                <boxGeometry args={[4, 0.3, 3]} />
                <meshStandardMaterial color="#475569" />
            </mesh>
            <mesh position={[-4, 0, 0]}>
                <boxGeometry args={[4, 0.3, 3]} />
                <meshStandardMaterial color="#475569" />
            </mesh>
            {/* Engine glow */}
            <pointLight color="#ff3300" intensity={3} distance={12} position={[0, -0.5, 4]} />
            {/* Laser beam as primitive */}
            <primitive object={laser} />
        </group>
    );
}

// ── Ground unit visuals ───────────────────────────────────────────────────────

function GroundUnitMesh({ unit }: { unit: AlienGroundUnit }) {
    const groupRef = useRef<THREE.Group>(null);

    useFrame(({ clock }) => {
        if (!groupRef.current) return;
        groupRef.current.position.set(unit.position.x, 0.5, unit.position.z);
        groupRef.current.rotation.y = clock.elapsedTime * 2;
    });

    return (
        <group ref={groupRef}>
            {/* Body */}
            <mesh>
                <sphereGeometry args={[0.8, 8, 6]} />
                <meshStandardMaterial
                    color="#7c3aed"
                    emissive="#4c1d95"
                    emissiveIntensity={0.6}
                />
            </mesh>
            {/* Legs */}
            {[0, 1, 2, 3].map((i) => {
                const angle = (i / 4) * Math.PI * 2;
                return (
                    <mesh key={i} position={[Math.cos(angle) * 0.7, -0.6, Math.sin(angle) * 0.7]}>
                        <cylinderGeometry args={[0.08, 0.08, 0.8, 4]} />
                        <meshStandardMaterial color="#6d28d9" />
                    </mesh>
                );
            })}
            <pointLight color="#7c3aed" intensity={1.5} distance={6} />
        </group>
    );
}

// ── Alert banner ─────────────────────────────────────────────────────────────

// ── Main component ────────────────────────────────────────────────────────────

export function AlienInvasion() {
    const alienState = useGameStore((s) => s.alienState);
    const gameMode   = useGameStore((s) => s.gameMode);

    if (gameMode !== "survival") return null;
    if (alienState.wave === 0) return null;

    return (
        <>
            {alienState.ships.map((ship) => (
                <ShipMesh key={ship.id} ship={ship} />
            ))}
            {alienState.groundUnits.map((unit) => (
                <GroundUnitMesh key={unit.id} unit={unit} />
            ))}
        </>
    );
}
