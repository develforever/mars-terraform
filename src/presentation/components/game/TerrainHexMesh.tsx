import { forwardRef } from "react";
import type { Mesh } from "three";
import { SmoothTerrain } from "../../generator/components/viewport/SmoothTerrain";
import type { HexGrid } from "../../generator/hex/HexGrid";

export interface TerrainHexMeshProps {
  hexGrid?: HexGrid | null;
}

export const TerrainHexMesh = forwardRef<Mesh, TerrainHexMeshProps>(
  ({ hexGrid }, ref) => {
    return <SmoothTerrain ref={ref} hexGrid={hexGrid} />;
  }
);

TerrainHexMesh.displayName = "TerrainHexMesh";

export default TerrainHexMesh;
