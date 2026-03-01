import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Mars } from "./Mars";

/** Wrapper: tylko Canvas */
export function Scene3D() {
  return (
    <Canvas className="main-canvas" camera={{ fov: 60, position: [12, 14, 12] }}>
      <World />
    </Canvas>
  );
}

function World() {


  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight position={[10, 15, 5]} intensity={1.2} castShadow />

      <Mars />

      <OrbitControls enabled={true} enableDamping dampingFactor={0.05}
        autoRotate={true}
        target={[0, 0, 0]}
        minDistance={60} maxDistance={500} maxPolarAngle={Math.PI / 2.05} />
    </>
  );
}
