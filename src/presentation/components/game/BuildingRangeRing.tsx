import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PlacedBuilding, BuildingDefinition } from "../../../domain/entities/Building";
import { getRangeRingConfig } from "./buildingRangeUtils";

export interface BuildingRangeRingProps {
  building: PlacedBuilding;
  definition?: BuildingDefinition;
}

export function BuildingRangeRing({ building, definition }: BuildingRangeRingProps) {
  const outerRingRef = useRef<THREE.Mesh>(null);
  const innerRingRef = useRef<THREE.Mesh>(null);

  const { radius, color, fillColor } = useMemo(
    () => getRangeRingConfig(building, definition),
    [building, definition]
  );

  useFrame((_, delta) => {
    if (outerRingRef.current) {
      outerRingRef.current.rotation.z += delta * 0.4;
    }
    if (innerRingRef.current) {
      innerRingRef.current.rotation.z -= delta * 0.2;
    }
  });

  const ringThickness = Math.max(0.1, radius * 0.035);

  return (
    <group position={[0, 0.04, 0]}>
      {/* Semi-transparent ground zone fill */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius, 64]} />
        <meshBasicMaterial
          color={fillColor}
          transparent
          opacity={0.12}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Solid outer boundary ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[Math.max(0.1, radius - ringThickness), radius, 64]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.7}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Rotating dashed / accent ring */}
      <mesh ref={outerRingRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[Math.max(0.1, radius - ringThickness * 2), radius - ringThickness * 1.2, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.35}
          depthWrite={false}
          wireframe={true}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Concentric inner subtle ring */}
      <mesh ref={innerRingRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[Math.max(0.1, radius * 0.5 - 0.05), radius * 0.5, 48]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.25}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

export default BuildingRangeRing;
