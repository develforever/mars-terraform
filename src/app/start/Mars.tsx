import { useTexture } from "@react-three/drei";
import { RepeatWrapping, Mesh } from "three";

export const Mars = ({ ref }: { ref?: React.Ref<Mesh> }) => {

  const sphereSize = { x: 20, z: 20 };

  const [colorMap, dispMap] = useTexture([
    "/textures/mars_colorx1.png",
    "/textures/mars_displacementx1.png",
  ]);
  [colorMap, dispMap].forEach(t => { t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(1, 1); });

  return (
    <mesh ref={ref as any} rotation-x={-Math.PI / 2} receiveShadow>
      <sphereGeometry args={[sphereSize.x, sphereSize.z, 256, 256]} />
      <meshStandardMaterial
        map={colorMap}
        displacementMap={dispMap}
        displacementScale={0.6}
        roughness={1}
        metalness={0}
      />
    </mesh>
  );
};
