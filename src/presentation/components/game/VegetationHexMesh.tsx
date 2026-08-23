/**
 * VegetationHexMesh.tsx
 *
 * Procedural Low-Poly Instanced Vegetation & Moss Clusters for Mars Terraforming.
 * Renders dynamic tufts on hexes where vegetationFactor > 0.3.
 * Scales density and biomass size with terraforming progress.
 * Strict GPU resource cleanup via dispose().
 */

import { forwardRef, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGameStore } from "../../../application/store/useGameStore";
import { createTuftGeometry, populateVegetationInstances } from "./vegetationGeometry";
import type { HexGrid } from "../../generator/hex/HexGrid";

export interface VegetationHexMeshProps {
  hexGrid?: HexGrid | null;
}

export const VegetationHexMesh = forwardRef<THREE.InstancedMesh, VegetationHexMeshProps>(
  ({ hexGrid: propHexGrid }, ref) => {
    const storeHexGrid = useGameStore((state) => state.hexGrid);
    const terraforming = useGameStore((state) => state.terraforming);
    const o2Accumulated = useGameStore((state) => state.o2Accumulated);
    const waterLevel = useGameStore((state) => state.waterLevel);
    const difficulty = useGameStore((state) => state.difficulty);

    const hexGrid = propHexGrid ?? storeHexGrid;

    const meshRef = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);

    // Create shared geometry & material
    const geometry = useMemo(() => createTuftGeometry(), []);
    const material = useMemo(
      () =>
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.85,
          metalness: 0.05,
          side: THREE.DoubleSide,
        }),
      []
    );

    // Calculate maximum instance capacity based on hex grid size (up to 6 tufts per hex)
    const maxInstances = useMemo(() => {
      const cellCount = hexGrid ? hexGrid.getAllCells().length : 400;
      return Math.max(100, cellCount * 6);
    }, [hexGrid]);

    // Cleanup GPU resources on unmount
    useEffect(() => {
      return () => {
        geometry.dispose();
        material.dispose();
      };
    }, [geometry, material]);

    // Update instances when biosphere / terraforming parameters change
    useEffect(() => {
      const instMesh = (ref && "current" in ref ? ref.current : null) || meshRef.current;
      if (!instMesh || !hexGrid) return;
      if (typeof instMesh.setMatrixAt !== "function") return;

      populateVegetationInstances(
        instMesh,
        hexGrid,
        {
          waterLevel,
          o2Accumulated,
          terraforming,
          difficulty,
          maxInstances,
        },
        dummy
      );
    }, [hexGrid, terraforming, o2Accumulated, waterLevel, difficulty, maxInstances, dummy, ref]);

    return (
      <instancedMesh
        ref={(node) => {
          meshRef.current = node;
          if (typeof ref === "function") {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        args={[geometry, material, maxInstances]}
        receiveShadow
        castShadow
      />
    );
  }
);

VegetationHexMesh.displayName = "VegetationHexMesh";

export default VegetationHexMesh;
