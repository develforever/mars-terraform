import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Mars } from "./Mars";
import { MarsEnvironment } from "./MarsEnvironment";

interface Scene3DProps {
    onClick: () => void;
}

export function StartScene3D({ onClick }: Scene3DProps) {
    return (
        <Canvas className="main-canvas" camera={{ fov: 60, position: [12, 14, 12] }}>
            <World onClick={onClick} />
        </Canvas>
    );
}

function World({ onClick }: Scene3DProps) {
    return (
        <>
            <MarsEnvironment />

            <Mars onClick={onClick} />

            <OrbitControls
                enabled={true}
                enableDamping
                dampingFactor={0.05}
                autoRotate={true}
                target={[0, 0, 0]}
                minDistance={60}
                maxDistance={500}
                maxPolarAngle={Math.PI / 1.05}
            />
        </>
    );
}
