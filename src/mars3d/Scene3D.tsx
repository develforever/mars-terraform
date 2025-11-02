import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useRef } from "react";
import { DirectionalLight, Mesh, Raycaster, Vector3 } from "three";
import { usePlacement } from "./usePlacement";
import { MarsTerrain } from "./MarsTerrain";
import { GridOverlay } from "./GridOverlay";
import { Buildings, HoverGhost } from "./Buildings";

export function Scene3D(){
  
  return (
    <Canvas className="main-canvas" camera={{ fov: 60, position: [12,14,12] }}>
       <World />
    </Canvas>
  );
}

/** Wewnątrz <Canvas>: tu możemy używać hooków R3F */
function World() {
  const terrainRef = useRef<Mesh>(null);

  // sampler wysokości z terenu (ray z góry w dół)
  const ray = new Raycaster();
  const from = new Vector3();
  const down = new Vector3(0, -1, 0);
  const getY = (x: number, z: number) => {
    if (!terrainRef.current) return 0;
    from.set(x, 1000, z);
    ray.set(from, down);
    return ray.intersectObject(terrainRef.current, true)[0]?.point.y ?? 0;
  };
  
  const lightRef = useRef<DirectionalLight>(null);
  const clock = useRef(0);

  useFrame((_, delta) => {
    clock.current += delta * 0.1; // prędkość obrotu
    if (lightRef.current) {
      const angle = clock.current;
      lightRef.current.position.set(Math.sin(angle) * 20, Math.cos(angle) * 20, 5);
    }
  });

  usePlacement({ grid: 1, getHeightAt: getY });

  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight ref={lightRef} intensity={1.2} castShadow />

      {/* Teren z refem (forwardRef w MarsTerrain już jest) */}
      <MarsTerrain ref={terrainRef} />

      <GridOverlay />
      <Buildings />
      <HoverGhost />

      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={5}
        maxDistance={50}
        maxPolarAngle={Math.PI / 2.05}
      />
    </>
  );
}