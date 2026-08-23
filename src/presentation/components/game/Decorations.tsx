import { Suspense, useMemo } from "react";
import { useGameStore } from "../../../application/store/useGameStore";
import { hexToWorld } from "../../generator/hex/HexMath";
import { useTerrainHeight } from "./TerrainHeightContext";
import { DecorMesh } from "../../generator/components/viewport/DecorMeshes";

export const Decorations = () => {
  const decorations = useGameStore((state) => state.decorations ?? state.decor ?? []);
  const getTerrainY = useTerrainHeight();

  const items = useMemo(() => {
    return decorations.map((item, idx) => {
      const [q, r] = item.pos;
      const [wx, wz] = hexToWorld(q, r);
      const wy = getTerrainY(wx, wz);
      return {
        key: `decor-${idx}-${q}-${r}`,
        pos: [wx, wy, wz] as [number, number, number],
        model: item.model,
        rot: item.rot,
        scale: item.scale * 1.8,
      };
    });
  }, [decorations, getTerrainY]);

  if (items.length === 0) return null;

  return (
    <group name="gameplay-decorations">
      <Suspense fallback={null}>
        {items.map((it) => (
          <group key={it.key} position={it.pos}>
            <DecorMesh model={it.model} scale={it.scale} rot={it.rot} />
          </group>
        ))}
      </Suspense>
    </group>
  );
};

export default Decorations;
