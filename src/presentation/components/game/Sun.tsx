import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

interface SunProps {
    position: THREE.Vector3;
    coreRadius?: number;
    flareSize?: number;
}

const coronaVertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const coronaFragmentShader = `
    varying vec2 vUv;
    uniform vec3 uColorCore;
    uniform vec3 uColorCorona;
    uniform float uIntensity;

    void main() {
        vec2 uv = (vUv - 0.5) * 2.0;
        float dist = length(uv);
        if (dist >= 1.0) discard;

        // Okno wygaszania zapewniające płynne zejście do absolutnego zera na krawędzi billboardu
        float edgeWindow = smoothstep(1.0, 0.2, dist);

        // Wielofazowy, gładki spadek wykładniczy
        float innerCore = exp(-dist * 18.0) * 16.0;
        float corona = exp(-dist * 4.8) * 2.6;
        float wideGlare = pow(max(1.0 - dist, 0.0), 3.0) * 0.8;

        // Subtelne promienie dyfrakcyjne
        float angle = atan(uv.y, uv.x);
        float rays = sin(angle * 8.0) * 0.08 + sin(angle * 12.0) * 0.04;
        float rayGlow = exp(-dist * 3.5) * max(rays, 0.0);

        float totalGlow = (innerCore + corona + wideGlare + rayGlow) * edgeWindow * uIntensity;

        // Gradient barwny: biało-złoty rdzeń -> bursztynowa poświata
        float colorMix = clamp(exp(-dist * 3.5), 0.0, 1.0);
        vec3 col = mix(uColorCorona, uColorCore, colorMix);

        // Screen-space dither eliminujący 8-bit color banding
        float dither = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;

        gl_FragColor = vec4(col * totalGlow + dither, totalGlow);
    }
`;

export function Sun({ position, coreRadius = 7, flareSize = 160 }: SunProps) {
    const sunRef = useRef<THREE.Group>(null);

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

    const coronaUniforms = useMemo(
        () => ({
            uColorCore: { value: new THREE.Color(1.5, 1.4, 1.2) },
            uColorCorona: { value: new THREE.Color(1.0, 0.45, 0.08) },
            uIntensity: { value: 2.8 },
        }),
        []
    );

    useFrame((state) => {
        if (sunRef.current) {
            sunRef.current.position.copy(position);
            sunRef.current.quaternion.copy(state.camera.quaternion);
        }
    });

    return (
        <group ref={sunRef}>
            {/* Fizyczny dysk słońca (HDR Emissive Mesh) */}
            <mesh>
                <sphereGeometry args={[coreRadius, 64, 64]} />
                <meshStandardMaterial
                    map={colorMap}
                    displacementMap={dispMap}
                    displacementScale={0.2}
                    emissive={new THREE.Color("#ffffff")}
                    emissiveMap={colorMap}
                    emissiveIntensity={15}
                    roughness={1}
                    metalness={0}
                    toneMapped={false}
                    fog={false}
                />
            </mesh>

            {/* Proceduralna korona słoneczna z analitycznym spadkiem wykładniczym (Billboard) */}
            <mesh>
                <planeGeometry args={[flareSize, flareSize]} />
                <shaderMaterial
                    vertexShader={coronaVertexShader}
                    fragmentShader={coronaFragmentShader}
                    uniforms={coronaUniforms}
                    transparent
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                    toneMapped={false}
                    side={THREE.DoubleSide}
                    fog={false}
                />
            </mesh>
        </group>
    );
}
