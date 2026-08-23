import { useRef } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGameStore } from "../../../application/store/useGameStore";
import { useUIStore } from "../../../application/store/useUIStore";
import { BUILDING_DEFINITIONS } from "../../../domain/config/buildings";
import { hexToWorld, worldToHex, hexNeighbors } from "../../generator/hex/HexMath";
import { useTerrainHeight } from "./TerrainHeightContext";
import type { ResourceType } from "../../../domain/mapEditorTypes";

const RESOURCE_COLORS: Record<ResourceType, string> = {
  minerals: "#f97316", // vibrant amber/orange
  ice:      "#38bdf8", // icy cyan
  organics: "#4ade80", // bio green
  energy:   "#facc15", // energy yellow
};

const RESOURCE_ICONS: Record<ResourceType, string> = {
  minerals: "⛏",
  ice:      "🧊",
  organics: "🌿",
  energy:   "⚡",
};

interface DepositMarkerProps {
  id: string;
  type: ResourceType;
  pos: [number, number];
  amount: number;
  richness: string;
}

const DepositMarker = ({ id, type, pos, amount, richness }: DepositMarkerProps) => {
  const [q, r] = pos;
  const [wx, wz] = hexToWorld(q, r);
  const terrainY = useTerrainHeight();
  const wy = terrainY(wx, wz);

  const hoverCell = useUIStore((s) => s.hoverCell);
  const buildMode = useUIStore((s) => s.buildMode);
  const selectedBuildingId = useUIStore((s) => s.selectedBuildingId);

  const groupRef = useRef<THREE.Group>(null);
  const t = useRef(Math.random() * Math.PI * 2);

  // Check if this deposit is highlighted by the current build ghost
  let isHighlighted = false;
  if (buildMode === "place" && selectedBuildingId && hoverCell) {
    const def = BUILDING_DEFINITIONS[selectedBuildingId];
    if (def?.extractsDeposit === type && amount > 0) {
      const [hq, hr] = worldToHex(hoverCell.x, hoverCell.z);
      const isDirect = hq === q && hr === r;
      const isNeighbor = hexNeighbors(hq, hr).some(([nq, nr]) => nq === q && nr === r);
      isHighlighted = isDirect || isNeighbor;
    }
  }

  const isDepleted = amount <= 0;
  const baseColor = RESOURCE_COLORS[type] ?? "#ffffff";
  const displayColor = isDepleted ? "#64748b" : baseColor;

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    t.current += delta * (isHighlighted ? 2.5 : 1.2);
    groupRef.current.position.y = (isHighlighted ? 0.7 : 0.4) + Math.sin(t.current) * (isHighlighted ? 0.12 : 0.05);
    groupRef.current.rotation.y += delta * (isHighlighted ? 1.5 : 0.6);
  });

  return (
    <group key={id} position={[wx, wy, wz]}>
      {/* Floating 3D crystal / ore / resource node mesh */}
      <group ref={groupRef} position={[0, 0.4, 0]}>
        <mesh castShadow receiveShadow>
          <octahedronGeometry args={[isHighlighted ? 0.55 : 0.4, 0]} />
          <meshStandardMaterial
            color={displayColor}
            emissive={displayColor}
            emissiveIntensity={isHighlighted ? 1.2 : isDepleted ? 0.05 : 0.4}
            roughness={isDepleted ? 0.9 : 0.2}
            metalness={isDepleted ? 0.1 : 0.8}
            wireframe={isDepleted}
          />
        </mesh>
      </group>

      {/* Hex terrain ring highlight */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
        <ringGeometry args={[isHighlighted ? 0.4 : 0.5, isHighlighted ? 1.1 : 0.8, 16]} />
        <meshBasicMaterial
          color={isHighlighted ? "#00ff88" : displayColor}
          transparent
          opacity={isHighlighted ? 0.75 : isDepleted ? 0.15 : 0.35}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Floating UI tag */}
      <Html position={[0, isHighlighted ? 2.0 : 1.4, 0]} center distanceFactor={70} occlude={false} zIndexRange={[0, 0]}>
        <div
          className={`px-1.5 py-0.5 rounded text-[11px] font-mono whitespace-nowrap pointer-events-none transition-all duration-200 select-none shadow-md ${
            isHighlighted
              ? "scale-110 border-2 border-emerald-400 font-bold shadow-emerald-500/50 bg-zinc-950/90 text-emerald-300"
              : isDepleted
              ? "opacity-50 line-through bg-zinc-900/80 text-zinc-400 border border-zinc-700"
              : "bg-zinc-950/80 text-zinc-200 border border-zinc-700/80"
          }`}
          style={{
            borderColor: isHighlighted ? "#34d399" : displayColor + "aa",
          }}
        >
          <span className="mr-1">{RESOURCE_ICONS[type]}</span>
          <span className="capitalize">{type}</span>
          <span className="mx-1 opacity-60">·</span>
          <span>{isDepleted ? "0 (Wyczerpane)" : Math.round(amount)}</span>
          {richness && !isDepleted && (
            <span className="ml-1 text-[9px] uppercase px-1 rounded bg-zinc-800 text-zinc-400">
              {richness}
            </span>
          )}
        </div>
      </Html>
    </group>
  );
};

export function ResourceDepositMarkers() {
  const resourceNodes = useGameStore((s) => s.resourceNodes);

  if (!resourceNodes || resourceNodes.length === 0) return null;

  return (
    <>
      {resourceNodes.map((n) => (
        <DepositMarker
          key={n.id}
          id={n.id}
          type={n.type}
          pos={n.pos}
          amount={n.amount}
          richness={n.richness}
        />
      ))}
    </>
  );
}

export default ResourceDepositMarkers;
