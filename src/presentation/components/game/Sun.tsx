import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

interface SunProps {
    position: THREE.Vector3;
}

interface FresnelGlowProps {
    radius: number;
    color: string;
    opacity: number;
    power?: number;
}

function FresnelGlow({ radius, color, opacity, power = 2.0 }: FresnelGlowProps) {
    return (
        <mesh>
            <sphereGeometry args={[radius, 64, 64]} />
            <shaderMaterial
                transparent
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                side={THREE.BackSide}
                fog={false}
                uniforms={{
                    uColor: { value: new THREE.Color(color) },
                    uOpacity: { value: opacity },
                    uPower: { value: power },
                }}
                vertexShader={`
                    varying vec3 vNormal;
                    varying vec3 vViewDir;
                    void main() {
                        vNormal = normalize(normalMatrix * normal);
                        vec4 worldPos = modelMatrix * vec4(position, 1.0);
                        vViewDir = normalize(cameraPosition - worldPos.xyz);
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }
                `}
                fragmentShader={`
                    varying vec3 vNormal;
                    varying vec3 vViewDir;
                    uniform vec3 uColor;
                    uniform float uOpacity;
                    uniform float uPower;
                    void main() {
                        float fresnel = 1.0 - abs(dot(vNormal, vViewDir));
                        fresnel = pow(fresnel, uPower);
                        gl_FragColor = vec4(uColor, fresnel * uOpacity);
                    }
                `}
            />
        </mesh>
    );
}

export function Sun({ position }: SunProps) {
    const sunRef = useRef<THREE.Group>(null);
    const glowRef = useRef<THREE.Mesh>(null);

    const [colorMap, dispMap] = useTexture([
        "/textures/2k_sun.jpg",
        "/textures/2k_sun_displacement.jpg",
    ]);

    useMemo(() => {
        [colorMap, dispMap].forEach((t) => {
            t.wrapS = t.wrapT = THREE.RepeatWrapping;
            t.repeat.set(1, 1);
        });
    }, [colorMap, dispMap]);

    useFrame((state) => {
        if (sunRef.current) {
            sunRef.current.position.copy(position);
            sunRef.current.lookAt(state.camera.position);
        }

        if (glowRef.current) {
            glowRef.current.rotation.z += 0.005;
        }
    });

    return (
        <group ref={sunRef}>
            {/* Główne ciało słońca */}
            <mesh>
                <sphereGeometry args={[5, 64, 64]} />
                <meshStandardMaterial
                    map={colorMap}
                    displacementMap={dispMap}
                    displacementScale={0.2}
                    emissive={new THREE.Color("#ffffff")}
                    emissiveMap={colorMap}
                    emissiveIntensity={2}
                    roughness={1}
                    metalness={0}
                    fog={false}
                />
            </mesh>

            {/* Gorąca wewnętrzna korona */}
            <mesh ref={glowRef}>
                <sphereGeometry args={[8, 64, 64]} />
                <meshBasicMaterial
                    color="#fff5bb"
                    transparent
                    opacity={0.6}
                    blending={THREE.AdditiveBlending}
                    fog={false}
                />
            </mesh>

            {/* Fresnel glow layers — smooth edge falloff */}
            <FresnelGlow radius={12} color="#ffeebb" opacity={0.5} power={1.5} />
            <FresnelGlow radius={22} color="#ffcc33" opacity={0.35} power={2.5} />
            <FresnelGlow radius={45} color="#ff6600" opacity={0.15} power={4.0} />
        </group>
    );
}
