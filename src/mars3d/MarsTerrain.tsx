import { forwardRef } from "react";
import { useTexture } from "@react-three/drei";
import { RepeatWrapping, Mesh } from "three";

export const MarsTerrain = forwardRef<Mesh>(function MarsTerrain(_, ref) {
  // wrzuć pliki do public/textures/ (możesz na start pominąć i użyć koloru)
  const [colorMap, dispMap] = useTexture([
    "/textures/mars_color.png",
    "/textures/mars_displacement.png",
  ]);
  [colorMap, dispMap].forEach(t => { t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(1,1); });

  return (
    <mesh ref={ref as any} rotation-x={-Math.PI/2} receiveShadow>
      <planeGeometry args={[100, 100, 256, 256]} />
      <meshStandardMaterial
        map={colorMap}
        displacementMap={dispMap}
        displacementScale={1.2}
        roughness={1}
        metalness={0}
      />
    </mesh>
  );
});
