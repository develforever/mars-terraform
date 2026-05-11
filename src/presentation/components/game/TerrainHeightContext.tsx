import { createContext, useContext } from "react";

export const TerrainHeightContext = createContext<(x: number, z: number) => number>(() => 0);

export function useTerrainHeight() {
    return useContext(TerrainHeightContext);
}
