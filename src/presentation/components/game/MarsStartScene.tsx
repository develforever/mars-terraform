import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { EffectComposer, Glitch } from "@react-three/postprocessing";
import * as THREE from "three";
import { Mars } from "./Mars";

interface Scene3DProps {
    onClick: () => void;
}

const CAM_POS: [number, number, number] = [52, -10, 44];
const LOOK_AT = new THREE.Vector3(0, 6, 0);

export function StartScene3D({ onClick }: Scene3DProps) {
    return (
        <Canvas
            className="main-canvas"
            camera={{ fov: 45, position: CAM_POS, near: 0.1, far: 250000 }}
        >
            <World onClick={onClick} />
        </Canvas>
    );
}

const atmosphereVertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const atmosphereFragmentShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vec3 viewDir = normalize(-vPosition);
    float dotVN = dot(viewDir, vNormal);
    float fresnel = pow(1.0 - max(dotVN, 0.0), 3.0);
    vec3 innerColor = vec3(1.0, 0.55, 0.25);
    vec3 outerColor = vec3(0.75, 0.25, 0.08);
    vec3 color = mix(outerColor, innerColor, fresnel);
    gl_FragColor = vec4(color, fresnel * 0.85);
  }
`;

function MarsAtmosphere() {
    const uniforms = useMemo(
        () => ({
            uTime: { value: 0 },
        }),
        []
    );

    return (
        <mesh scale={[1.05, 1.05, 1.05]}>
            <sphereGeometry args={[20, 128, 128]} />
            <shaderMaterial
                vertexShader={atmosphereVertexShader}
                fragmentShader={atmosphereFragmentShader}
                uniforms={uniforms}
                transparent
                side={THREE.BackSide}
                depthWrite={false}
            />
        </mesh>
    );
}

function StartEnvironment() {
    return (
        <>
            <color attach="background" args={["#050308"]} />
            <fogExp2 attach="fog" args={["#050308", 0.002]} />

            <ambientLight intensity={0.25} />

            <directionalLight
                position={[60, 15, 50]}
                intensity={2.2}
                color="#ffeedd"
                castShadow
            />

            <directionalLight
                position={[-30, -10, -20]}
                intensity={0.3}
                color="#4455aa"
            />

            <Stars
                radius={25000}
                depth={5000}
                count={12000}
                factor={15}
                saturation={0}
                fade
                speed={0.2}
            />
        </>
    );
}

function World({ onClick }: Scene3DProps) {
    const cameraTarget = useRef(LOOK_AT.clone());

    useFrame((state) => {
        state.camera.lookAt(cameraTarget.current);
    });

    return (
        <>
            <StartEnvironment />
            <Mars onClick={onClick} />
            <MarsAtmosphere />
            <EffectComposer>
                <Glitch
                    delay={new THREE.Vector2(1.5, 3.5)}
                    duration={new THREE.Vector2(0.1, 0.3)}
                    strength={new THREE.Vector2(0.1, 0.3)}
                    active
                    ratio={0.85}
                />
            </EffectComposer>
        </>
    );
}
