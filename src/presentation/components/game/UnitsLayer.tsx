import { useMemo, useRef, Suspense } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, Html } from "@react-three/drei";
import * as THREE from "three";
import type { Group } from "three";
import { useGameStore } from "../../../application/store/useGameStore";
import { useUIStore } from "../../../application/store/useUIStore";
import { UNIT_DEFINITIONS } from "../../../domain/config/units";
import { useTerrainHeight } from "./TerrainHeightContext";
import type { PlacedUnit } from "../../../domain/entities/Unit";

const MODEL_PATHS = {
  rover: "/models/mars/rover.glb",
  rover_combat: "/models/mars/rover_combat.glb",
  craft_miner: "/models/mars/craft_miner.glb",
  drone_repair: "/models/mars/drone_repair.glb",
  craft_hauler: "/models/mars/craft_hauler.glb",
} as const;

// Preload models
Object.values(MODEL_PATHS).forEach((path) => useGLTF.preload(path));

// ── Generic Unit Model Renderer ──────────────────────────────────────────────

interface UnitModelProps {
  modelPath: string;
  scale?: number;
  emissiveColor?: string;
  emissiveIntensity?: number;
}

function Unit3DModel({ modelPath, scale = 1.8, emissiveColor, emissiveIntensity = 0.2 }: UnitModelProps) {
  const gltf = useGLTF(modelPath) as { scene: Group };
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
        if (emissiveColor && mesh.material) {
          const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
          mat.emissive = new THREE.Color(emissiveColor);
          mat.emissiveIntensity = emissiveIntensity;
          mesh.material = mat;
        }
      }
    });
    return c;
  }, [gltf.scene, emissiveColor, emissiveIntensity]);

  return <primitive object={clone} scale={scale} />;
}

// ── Selection Ring Component ──────────────────────────────────────────────────

function SelectionRing({ isCombat }: { isCombat?: boolean }) {
  const ringRef = useRef<THREE.Mesh>(null);
  const color = isCombat ? "#00f0ff" : "#00e5ff";

  useFrame(({ clock }) => {
    if (ringRef.current) {
      ringRef.current.rotation.z = clock.elapsedTime * 0.8;
      const pulse = 0.95 + Math.sin(clock.elapsedTime * 4) * 0.05;
      ringRef.current.scale.set(pulse, pulse, 1);
    }
  });

  return (
    <group position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      {/* Outer ring */}
      <mesh ref={ringRef}>
        <ringGeometry args={[1.35, 1.5, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {/* Subtle glowing ground disc */}
      <mesh>
        <circleGeometry args={[1.35, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.12} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ── Health Bar Billboard Component ────────────────────────────────────────────

interface UnitHealthBarProps {
  currentHealth: number;
  maxHealth: number;
  isSelected: boolean;
  status: string;
}

function UnitHealthBar({ currentHealth, maxHealth, isSelected }: UnitHealthBarProps) {
  const hpPercent = Math.max(0, Math.min(100, (currentHealth / maxHealth) * 100));
  const isDamaged = currentHealth < maxHealth;

  if (!isSelected && !isDamaged) return null;

  const barColor = hpPercent > 50 ? "#22c55e" : hpPercent > 25 ? "#eab308" : "#ef4444";

  return (
    <Html position={[0, 2.2, 0]} center distanceFactor={25} zIndexRange={[100, 0]}>
      <div className="pointer-events-none flex flex-col items-center select-none" style={{ width: "48px" }}>
        {/* HP Bar */}
        <div className="w-full h-1.5 bg-black/80 rounded border border-gray-700 overflow-hidden shadow">
          <div
            className="h-full transition-all duration-150"
            style={{ width: `${hpPercent}%`, backgroundColor: barColor }}
          />
        </div>
      </div>
    </Html>
  );
}

// ── Single Unit Mesh & Controller ─────────────────────────────────────────────

interface SingleUnitProps {
  unit: PlacedUnit;
}

function SingleUnitMesh({ unit }: SingleUnitProps) {
  const groupRef = useRef<THREE.Group>(null);
  const visualPos = useRef(new THREE.Vector3(unit.position.x, unit.position.y, unit.position.z));
  const currentRotY = useRef(unit.heading);
  const getTerrainY = useTerrainHeight();

  const selectedUnitIds = useUIStore((state) => state.selectedUnitIds);
  const selectUnits = useUIStore((state) => state.selectUnits);
  const toggleSelectUnit = useUIStore((state) => state.toggleSelectUnit);
  const isSelected = selectedUnitIds.includes(unit.id);

  const def = UNIT_DEFINITIONS[unit.definitionId];
  const maxHealth = def?.stats.maxHealth ?? 100;
  const isAir = def?.category === "air";
  const isCombat = def?.role === "combat";
  const modelPath = def?.modelPath ?? MODEL_PATHS.rover;

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return;

    const targetX = unit.position.x;
    const targetZ = unit.position.z;
    const dx = targetX - visualPos.current.x;
    const dz = targetZ - visualPos.current.z;
    const dist = Math.hypot(dx, dz);

    if (dist > 15) {
      visualPos.current.set(targetX, unit.position.y, targetZ);
    } else if (dist > 0.001) {
      const speed = Math.max((def?.stats.speed ?? 2.5) * 1.2, dist * 4.0);
      const step = Math.min(dist, delta * speed);
      visualPos.current.x += (dx / dist) * step;
      visualPos.current.z += (dz / dist) * step;

      const targetAngle = Math.atan2(dx, dz);
      let angleDiff = targetAngle - currentRotY.current;
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
      currentRotY.current += angleDiff * Math.min(1, delta * 12);
    } else {
      let angleDiff = unit.heading - currentRotY.current;
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
      currentRotY.current += angleDiff * Math.min(1, delta * 8);
    }

    const groundY = getTerrainY(visualPos.current.x, visualPos.current.z);
    let finalY = groundY;
    let pitch = 0;
    let roll = 0;

    if (isAir) {
      const hover = Math.sin(clock.elapsedTime * 4 + unit.position.x) * 0.12;
      finalY = groundY + 2.4 + hover;
      roll = Math.sin(clock.elapsedTime * 3) * 0.04;
    } else {
      const sampleDist = 0.35;
      const sampleX = visualPos.current.x + Math.sin(currentRotY.current) * sampleDist;
      const sampleZ = visualPos.current.z + Math.cos(currentRotY.current) * sampleDist;
      const sampleY = getTerrainY(sampleX, sampleZ);
      pitch = Math.atan2(sampleY - groundY, sampleDist);
      const bob = dist > 0.05 ? Math.sin(clock.elapsedTime * 14) * 0.02 : 0;
      finalY = groundY + 0.08 + bob;
    }

    groupRef.current.position.set(visualPos.current.x, finalY, visualPos.current.z);
    groupRef.current.rotation.set(-pitch, currentRotY.current, roll);
  });

  const handleClick = (e: { stopPropagation: () => void; nativeEvent: MouseEvent }) => {
    e.stopPropagation();
    if (e.nativeEvent.shiftKey) {
      toggleSelectUnit(unit.id);
    } else {
      selectUnits([unit.id]);
    }
  };

  return (
    <group ref={groupRef} onClick={handleClick}>
      {isSelected && <SelectionRing isCombat={isCombat} />}

      <Suspense
        fallback={
          <mesh>
            <boxGeometry args={[1, 0.5, 1]} />
            <meshStandardMaterial color="#38bdf8" />
          </mesh>
        }
      >
        <Unit3DModel
          modelPath={modelPath}
          scale={def?.modelScale ?? 1.8}
          emissiveColor={isCombat ? "#ef4444" : isAir ? "#00e5ff" : undefined}
        />
      </Suspense>

      <UnitHealthBar
        currentHealth={unit.currentHealth}
        maxHealth={maxHealth}
        isSelected={isSelected}
        status={unit.status}
      />
    </group>
  );
}

// ── Main UnitsLayer Component ─────────────────────────────────────────────────

export function UnitsLayer() {
  const units = useGameStore((state) => state.units);

  return (
    <group>
      {units.map((unit) => (
        <SingleUnitMesh key={unit.id} unit={unit} />
      ))}
    </group>
  );
}
