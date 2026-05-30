import { useMemo, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGameStore } from "../../../application/store/useGameStore";
import { BUILDING_DEFINITIONS } from "../../../domain/config/buildings";
import { NeighborService } from "../../../domain/services/NeighborService";
import type { ConnectionType } from "../../../domain/entities/Building";

const CONNECTION_COLORS: Record<ConnectionType, string> = {
  power:   "#fde68a",
  water:   "#60a5fa",
  biomass: "#86efac",
  data:    "#c4b5fd",
};

function ConnectionTube({
  start,
  end,
  colorHex,
}: {
  start: THREE.Vector3;
  end: THREE.Vector3;
  colorHex: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef  = useRef<THREE.MeshStandardMaterial>(null);

  const geometry = useMemo(() => {
    const mid = new THREE.Vector3(
      (start.x + end.x) / 2,
      Math.max(start.y, end.y) + 1.5,
      (start.z + end.z) / 2,
    );
    const curve = new THREE.CatmullRomCurve3([start, mid, end]);
    return new THREE.TubeGeometry(curve, 12, 0.12, 6, false);
  }, [start, end]);

  // Dispose geometry on unmount
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ clock }) => {
    if (matRef.current) {
      matRef.current.emissiveIntensity = 0.4 + Math.sin(clock.elapsedTime * 2) * 0.2;
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshStandardMaterial
        ref={matRef}
        color={colorHex}
        emissive={colorHex}
        emissiveIntensity={0.4}
        transparent
        opacity={0.55}
      />
    </mesh>
  );
}

export function BuildingConnections() {
  const placed = useGameStore((s) => s.placed);

  const pairs = useMemo(
    () => NeighborService.getConnectionPairs(placed, BUILDING_DEFINITIONS),
    [placed],
  );

  if (pairs.length === 0) return null;

  return (
    <>
      {pairs.map(([a, b]) => {
        const defA = BUILDING_DEFINITIONS[a.definitionId];
        const defB = BUILDING_DEFINITIONS[b.definitionId];
        const typeA = defA?.connectionType;
        const typeB = defB?.connectionType;
        const type: ConnectionType = typeA ?? typeB ?? "power";
        const color = CONNECTION_COLORS[type];

        const posA = new THREE.Vector3(a.position.x, a.position.y + 1, a.position.z);
        const posB = new THREE.Vector3(b.position.x, b.position.y + 1, b.position.z);

        return (
          <ConnectionTube
            key={`${a.id}-${b.id}`}
            start={posA}
            end={posB}
            colorHex={color}
          />
        );
      })}
    </>
  );
}
