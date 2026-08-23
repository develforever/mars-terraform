/**
 * WaterHexMesh.tsx
 *
 * 3D Dynamic Water Surface for Martian Craters & Lowlands.
 * Renders a subdivided wave-animated plane at the global water level.
 * Features smooth water rising animation, custom shader effects, and strict resource disposal.
 */

import { forwardRef, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGameStore } from "../../../application/store/useGameStore";
import { HEX_SIZE } from "../../generator/hex/HexMath";
import { createWaterMaterial } from "./WaterMaterial";

export interface WaterHexMeshProps {
  waterLevel?: number;
  mapRadius?: number;
}

export const WaterHexMesh = forwardRef<THREE.Mesh, WaterHexMeshProps>(
  ({ waterLevel: propWaterLevel, mapRadius = 22 }, ref) => {
    const storeWaterLevel = useGameStore((state) => state.waterLevel);
    const storeHexGrid = useGameStore((state) => state.hexGrid);

    const targetWaterLevel = propWaterLevel ?? storeWaterLevel;
    const gridRadius = storeHexGrid?.radius ?? mapRadius;

    const innerMeshRef = useRef<THREE.Mesh>(null);
    const currentYRef = useRef<number>(targetWaterLevel);

    // Calculate map extent in world units
    const worldRadius = useMemo(() => {
      return (gridRadius + 2) * HEX_SIZE * 1.55;
    }, [gridRadius]);

    // Generate high-resolution circular water plane geometry
    const geometry = useMemo(() => {
      // CircleGeometry with fine radial and angular segments for smooth wave displacement
      const geo = new THREE.CircleGeometry(worldRadius, 72);
      geo.rotateX(-Math.PI / 2);
      return geo;
    }, [worldRadius]);

    // Create water shader material
    const material = useMemo(() => {
      return createWaterMaterial();
    }, []);

    // Clean up Three.js GPU resources on unmount or recreation
    useEffect(() => {
      return () => {
        geometry.dispose();
        material.dispose();
      };
    }, [geometry, material]);

    // Smooth water level transition and wave animation loop
    useFrame(({ clock }, delta) => {
      // Smooth damp interpolation for rising / receding water mirror
      currentYRef.current = THREE.MathUtils.damp(
        currentYRef.current,
        targetWaterLevel,
        2.5,
        delta
      );

      const targetMesh = (ref && "current" in ref ? ref.current : null) || innerMeshRef.current;
      if (targetMesh && targetMesh.position) {
        targetMesh.position.y = currentYRef.current;
      }

      if (material.uniforms.uTime) {
        material.uniforms.uTime.value = clock.elapsedTime;
      }
    });

    return (
      <mesh
        ref={(node) => {
          innerMeshRef.current = node;
          if (typeof ref === "function") {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        geometry={geometry}
        material={material}
        position={[0, targetWaterLevel, 0]}
        receiveShadow
        castShadow={false}
      />
    );
  }
);

WaterHexMesh.displayName = "WaterHexMesh";

export default WaterHexMesh;
