import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";
import { Mars } from "./Mars";
import { MarsEnvironment } from "./MarsEnvironment";

interface Scene3DProps {
    onClick: () => void;
}

export function StartScene3D({ onClick }: Scene3DProps) {
    return (
        <Canvas className="main-canvas" camera={{ fov: 60, position: [812, 14, 812], far: 250000 }}>
            <World onClick={onClick} />
        </Canvas>
    );
}

function World({ onClick }: Scene3DProps) {
    const controlsRef = useRef<any>(null);
    const marsGroupRef = useRef<THREE.Group>(null);
    const orbitT = useRef(Math.PI * 1.2); 

    useFrame((state, delta) => {
        if (controlsRef.current && marsGroupRef.current) {
            orbitT.current += delta * 0.05;
            const angle = orbitT.current;
            const distance = 800;
            
            const prevPos = marsGroupRef.current.position.clone();
            
            const marsX = Math.sin(angle) * distance;
            const marsZ = Math.cos(angle) * distance;
            const marsY = Math.sin(angle * 0.5) * distance * 0.5;
            
            const newPos = new THREE.Vector3(marsX, marsY, marsZ);
            marsGroupRef.current.position.copy(newPos);
            
            // if it's the first frame (prevPos 0,0,0), set camera to starting position near Mars
            if (prevPos.lengthSq() < 0.1) {
                state.camera.position.set(marsX + 40, marsY + 20, marsZ + 40);
                controlsRef.current.target.copy(newPos);
            } else {
                const deltaPos = newPos.clone().sub(prevPos);
                state.camera.position.add(deltaPos);
                controlsRef.current.target.copy(newPos);
            }
            controlsRef.current.update();
        }
    });

    return (
        <>
            <MarsEnvironment />

            <group ref={marsGroupRef}>
                <Mars onClick={onClick} />
            </group>

            <OrbitControls
                ref={controlsRef}
                enabled={true}
                enableDamping
                dampingFactor={0.05}
                autoRotate={false}
                target={[0, 0, 0]}
                minDistance={2}
                maxDistance={1500}
                minPolarAngle={Math.PI / 4}
                maxPolarAngle={Math.PI * 3 / 4}
            />
        </>
    );
}
