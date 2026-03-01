import { useTexture } from "@react-three/drei";
import { RepeatWrapping, Mesh } from "three";
import { useMars } from "./store";

export const MarsTerrain = ({ ref }: { ref?: React.Ref<Mesh> }) => {

  const terrainSize = useMars(s => s.terrainSize);

  const [colorMap, dispMap] = useTexture([
    "/textures/mars_colorx1.png",
    "/textures/mars_displacementx1.png",
  ]);
  [colorMap, dispMap].forEach(t => { t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(1, 1); });

  return (
    <mesh ref={ref as any} rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[terrainSize.x, terrainSize.z, 32, 32]} />
      <meshStandardMaterial
        map={colorMap}
        displacementMap={dispMap}
        displacementScale={1.2}
        roughness={1}
        metalness={0}
      />
    </mesh>
  );
};
