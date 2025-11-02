import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useRef } from "react";
import { Mesh, Raycaster, Vector3, DirectionalLight } from "three";
import { usePlacement } from "./usePlacement";
import { MarsTerrain } from "./MarsTerrain";
import { GridOverlay } from "./GridOverlay";
import { Buildings, HoverGhost } from "./Buildings";
import { useMars } from "./store";

/** Wrapper: tylko Canvas */
export function Scene3D() {
  return (
    <Canvas className="main-canvas" camera={{ fov: 60, position: [12, 14, 12] }}>
      <World />
    </Canvas>
  );
}

function World() {
  const terrainRef = useRef<Mesh>(null);
  const sunRef = useRef<DirectionalLight>(null);
  const ray = new Raycaster();
  const from = new Vector3();
  const down = new Vector3(0, -1, 0);
  const setSun = useMars(s => s.setSun);

  const getY = (x:number,z:number)=>{ if(!terrainRef.current) return 0; from.set(x,1000,z); ray.set(from,down); return ray.intersectObject(terrainRef.current,true)[0]?.point.y ?? 0; };
  usePlacement({ grid: 1, getHeightAt: getY });

  // animacja słońca + obliczenie współczynnika dnia 0..1 (0 noc, 1 południe)
  const t = useRef(0);
  useFrame((_, delta) => {
    t.current += delta * 0.1; // prędkość doby
    const angle = t.current % (Math.PI * 2);
    const y = Math.cos(angle);              // +1 południe, -1 północ (noc)
    const dayFactor = Math.max(0, y);       // 0..1
    setSun(dayFactor);
    if (sunRef.current) {
      sunRef.current.position.set(Math.sin(angle) * 20, 10 + 20 * dayFactor, 5);
      sunRef.current.intensity = 0.6 + 0.9 * dayFactor;
    }
  });

  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight ref={sunRef} position={[10, 15, 5]} intensity={1.2} castShadow />

      <MarsTerrain ref={terrainRef} />
      <GridOverlay />
      <Buildings />
      <HoverGhost />

      <OrbitControls enableDamping dampingFactor={0.05} minDistance={5} maxDistance={50} maxPolarAngle={Math.PI/2.05}/>
    </>
  );
}
