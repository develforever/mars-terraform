import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { PostProcessingComposer } from "./PostProcessingComposer";
import * as THREE from "three";
import { Mars } from "./Mars";
import { Sun } from "./Sun";

const WARP_LINE_COUNT = 8000;

function WarpStarLines({ warpSpeed = false }: { warpSpeed?: boolean }) {
    const meshRef = useRef<THREE.LineSegments>(null);
    const matRef = useRef<THREE.LineBasicMaterial | null>(null);
    const timeRef = useRef(0);
    const warpRef = useRef(0);

    const { basePositions, speeds } = useMemo(() => {
        const positions = new Float32Array(WARP_LINE_COUNT * 6);
        const spd = new Float32Array(WARP_LINE_COUNT);

        for (let i = 0; i < WARP_LINE_COUNT; i++) {
            const r = 150 + Math.random() * 800;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);

            const x = r * Math.sin(phi) * Math.cos(theta);
            const y = r * Math.sin(phi) * Math.sin(theta);
            const z = r * Math.cos(phi);

            positions[i * 6] = x;
            positions[i * 6 + 1] = y;
            positions[i * 6 + 2] = z;
            positions[i * 6 + 3] = x;
            positions[i * 6 + 4] = y;
            positions[i * 6 + 5] = z;

            spd[i] = 0.5 + Math.random() * 2.0;
        }

        return { basePositions: positions.slice(), speeds: spd };
    }, []);

    useFrame((_state, delta) => {
        timeRef.current += delta;

        const target = warpSpeed ? 1.0 : 0.0;
        warpRef.current += (target - warpRef.current) * 0.04;
        const w = warpRef.current;

        if (matRef.current) {
            matRef.current.opacity = 0.7 + w * 0.3;
            const r = 1.0;
            const g = 0.95 + w * 0.05;
            const b = 0.85 + w * 0.15;
            matRef.current.color.setRGB(r, g, b);
        }

        const geo = meshRef.current?.geometry;
        if (!geo) return;
        const posAttr = geo.attributes.position;
        const pos = posAttr.array as Float32Array;
        const t = timeRef.current;
        const speedMul = 0.15 + w * 50.0;
        const stretch = 0.5 + w * 250.0;

        for (let i = 0; i < WARP_LINE_COUNT; i++) {
            const bx = basePositions[i * 6];
            const by = basePositions[i * 6 + 1];
            const bz = basePositions[i * 6 + 2];
            const s = speeds[i];

            const move = t * speedMul * s;
            const z = ((bz + move) % 2000) - 1000;

            pos[i * 6] = bx;
            pos[i * 6 + 1] = by;
            pos[i * 6 + 2] = z;
            pos[i * 6 + 3] = bx;
            pos[i * 6 + 4] = by;
            pos[i * 6 + 5] = z + stretch;
        }

        posAttr.needsUpdate = true;
    });

    const geo = useMemo(() => {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(basePositions.slice(), 3));
        return g;
    }, [basePositions]);

    return (
        <lineSegments ref={meshRef} geometry={geo}>
            <lineBasicMaterial
                ref={matRef}
                color="#ffffff"
                transparent
                opacity={0.7}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
            />
        </lineSegments>
    );
}

const SHIP_MODELS = [
    "/models/mars/craft_speederA.glb",
    "/models/mars/craft_speederB.glb",
    "/models/mars/craft_speederC.glb",
    "/models/mars/craft_speederD.glb",
    "/models/mars/craft_racer.glb",
    "/models/mars/craft_miner.glb",
    "/models/mars/craft_cargoA.glb",
    "/models/mars/rover.glb",
];

SHIP_MODELS.forEach((path) => useGLTF.preload(path));

interface Scene3DProps {
    onClick: () => void;
    warpSpeed?: boolean;
}

const CAM_POS: [number, number, number] = [52, -10, 44];
const LOOK_AT = new THREE.Vector3(0, 6, 0);

export function StartScene3D({ onClick, warpSpeed = false }: Scene3DProps) {
    return (
        <Canvas
            className="main-canvas"
            camera={{ fov: 45, position: CAM_POS, near: 0.1, far: 250000 }}
        >
            <World onClick={onClick} warpSpeed={warpSpeed} />
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
  uniform float uOpacity;
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vec3 viewDir = normalize(-vPosition);
    float dotVN = dot(viewDir, vNormal);
    float fresnel = pow(1.0 - max(dotVN, 0.0), 3.0);
    float edgeFade = 1.0 - smoothstep(0.7, 1.0, fresnel);
    vec3 innerColor = vec3(1.0, 0.55, 0.25);
    vec3 outerColor = vec3(0.75, 0.25, 0.08);
    vec3 color = mix(outerColor, innerColor, fresnel);
    gl_FragColor = vec4(color, fresnel * 0.7 * edgeFade * uOpacity);
  }
`;

function MarsAtmosphere() {
    const uniforms = useMemo(
        () => ({
            uOpacity: { value: 1.0 },
        }),
        []
    );

    useFrame(() => {
        uniforms.uOpacity.value = 0.75 + Math.sin(Date.now() * 0.0008) * 0.15;
    });

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

interface StartEnvironmentProps {
    warpSpeed?: boolean;
}

function StartEnvironment({ warpSpeed = false }: StartEnvironmentProps) {
    return (
        <>
            <color attach="background" args={["#050308"]} />
            <fogExp2 attach="fog" args={["#050308", 0.002]} />

            <ambientLight intensity={0.35} />

            {/* Blue fill light — subtle bounce from space */}
            <directionalLight
                position={[-30, -10, -20]}
                intensity={0.35}
                color="#445588"
            />

            <WarpStarLines warpSpeed={warpSpeed} />
        </>
    );
}

interface ShipOrbit {
    path: string;
    radius: number;
    speed: number;
    yOffset: number;
    phase: number;
    scale: number;
}

const ORBITS: ShipOrbit[] = [
    { path: SHIP_MODELS[0], radius: 21.5, speed: 0.12, yOffset: 0.3, phase: 0.0, scale: 0.12 },
    { path: SHIP_MODELS[1], radius: 22.2, speed: 0.08, yOffset: -0.2, phase: 0.8, scale: 0.12 },
    { path: SHIP_MODELS[2], radius: 21.8, speed: 0.10, yOffset: 0.5, phase: 1.6, scale: 0.12 },
    { path: SHIP_MODELS[3], radius: 22.5, speed: 0.07, yOffset: -0.4, phase: 2.4, scale: 0.12 },
    { path: SHIP_MODELS[4], radius: 21.2, speed: 0.14, yOffset: 0.1, phase: 3.2, scale: 0.10 },
    { path: SHIP_MODELS[5], radius: 22.8, speed: 0.06, yOffset: -0.1, phase: 4.0, scale: 0.12 },
    { path: SHIP_MODELS[6], radius: 21.0, speed: 0.05, yOffset: 0.4, phase: 4.8, scale: 0.14 },
    { path: SHIP_MODELS[7], radius: 21.6, speed: 0.04, yOffset: -0.3, phase: 5.6, scale: 0.10 },
];

function OrbitingShip({ orbit }: { orbit: ShipOrbit }) {
    const gltf = useGLTF(orbit.path) as { scene: THREE.Group };
    const meshRef = useRef<THREE.Group>(gltf.scene.clone(true));
    const phaseRef = useRef(orbit.phase);

    useFrame((_, delta) => {
        phaseRef.current += delta * orbit.speed;
        const x = Math.cos(phaseRef.current) * orbit.radius;
        const z = Math.sin(phaseRef.current) * orbit.radius;
        const y = orbit.yOffset;

        meshRef.current.position.set(x, y, z);

        const nextX = Math.cos(phaseRef.current + 0.05) * orbit.radius;
        const nextZ = Math.sin(phaseRef.current + 0.05) * orbit.radius;

        // Bottom of ship faces toward Mars center
        meshRef.current.up.set(-x, -y, -z).normalize();
        meshRef.current.lookAt(nextX, y, nextZ);
    });

    return (
        <group>
            <primitive object={meshRef.current} scale={orbit.scale} />
            <group position={[0, 0, 0.6]}>
                <mesh>
                    <coneGeometry args={[0.02, 0.3, 8]} />
                    <meshBasicMaterial color="#ff5522" transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
                </mesh>
            </group>
        </group>
    );
}

function OrbitShips() {
    return (
        <>
            {ORBITS.map((orbit, i) => (
                <OrbitingShip key={i} orbit={orbit} />
            ))}
        </>
    );
}

function StartSun() {
    const groupRef = useRef<THREE.Group>(null);
    const angleRef = useRef(Math.PI + 0.2);

    useFrame((_, delta) => {
        angleRef.current += delta * 0.005;
        const r = 60;
        if (groupRef.current) {
            groupRef.current.position.set(
                Math.cos(angleRef.current) * r,
                0,
                Math.sin(angleRef.current) * r
            );
        }
    });

    return (
        <group ref={groupRef}>
            <directionalLight
                intensity={2.5}
                color="#ffeedd"
                castShadow
            >
                <primitive object={new THREE.Object3D()} attach="target" position={[0, 0, 0]} />
            </directionalLight>
            <Sun position={new THREE.Vector3(0, 0, 0)} />
        </group>
    );
}

function World({ onClick, warpSpeed }: Scene3DProps) {
    const cameraTarget = useRef(LOOK_AT.clone());

    useFrame((state) => {
        state.camera.lookAt(cameraTarget.current);
    });

    return (
        <>
            <StartEnvironment warpSpeed={warpSpeed} />
            <Mars onClick={onClick} />
            <MarsAtmosphere />
            <StartSun />
            <OrbitShips />
            <PostProcessingComposer
                bloomIntensity={3.0}
                bloomThreshold={0.05}
                bloomSmoothing={0.5}
                glitch
            />
        </>
    );
}
