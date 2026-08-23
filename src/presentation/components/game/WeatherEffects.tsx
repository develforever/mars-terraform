import { useMemo, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGameStore } from "../../../application/store/useGameStore";
import { WeatherService } from "../../../domain/services/WeatherService";
import { TERRAIN_BOUNDS } from "../../utils/terrainBounds";

const DUST_PARTICLE_COUNT = 2500;
const AURORA_RIBBON_SEGMENTS_X = 64;
const AURORA_RIBBON_SEGMENTS_Y = 16;

const dustVertexShader = `
  uniform float uTime;
  uniform float uIntensity;
  uniform vec2 uBoundsX;
  uniform vec2 uBoundsZ;
  attribute float aScale;
  attribute vec3 aVelocity;
  varying float vAlpha;

  void main() {
    vec3 pos = position;
    // Animate along XZ wind vector with turbulence
    pos.x += sin(uTime * 1.5 + pos.y * 0.2) * 2.0 + aVelocity.x * uTime * (20.0 + uIntensity * 15.0);
    pos.z += cos(uTime * 1.2 + pos.x * 0.1) * 1.5 + aVelocity.z * uTime * (15.0 + uIntensity * 10.0);
    pos.y += sin(uTime * 2.0 + pos.x * 0.3) * 0.8 + aVelocity.y * uTime * 4.0;

    // Wrap around bounds
    float rangeX = uBoundsX.y - uBoundsX.x;
    float rangeZ = uBoundsZ.y - uBoundsZ.x;
    pos.x = uBoundsX.x + mod(pos.x - uBoundsX.x, rangeX);
    pos.z = uBoundsZ.x + mod(pos.z - uBoundsZ.x, rangeZ);
    pos.y = mod(pos.y, 30.0);

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Size attenuation with distance
    gl_PointSize = (aScale * (12.0 + uIntensity * 16.0)) / -mvPosition.z;

    // Edge fading near terrain bounds
    float normX = (pos.x - uBoundsX.x) / rangeX;
    float normZ = (pos.z - uBoundsZ.x) / rangeZ;
    float edgeFade = smoothstep(0.0, 0.1, normX) * smoothstep(1.0, 0.9, normX) *
                     smoothstep(0.0, 0.1, normZ) * smoothstep(1.0, 0.9, normZ);

    vAlpha = uIntensity * edgeFade * 0.75;
  }
`;

const dustFragmentShader = `
  uniform vec3 uColor;
  varying float vAlpha;

  void main() {
    // Soft circular particle with dithering edge
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard;

    float softEdge = 1.0 - smoothstep(0.2, 0.5, dist);
    gl_FragColor = vec4(uColor, vAlpha * softEdge);
  }
`;

const auroraVertexShader = `
  uniform float uTime;
  uniform float uIntensity;
  varying vec2 vUv;
  varying float vWave;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Fluid undulating wave displacement in curtain
    float wave1 = sin(pos.x * 0.04 + uTime * 0.7) * 6.0;
    float wave2 = cos(pos.z * 0.03 + uTime * 0.5) * 4.0;
    float wave3 = sin((pos.x + pos.z) * 0.02 + uTime * 1.1) * 3.0;

    pos.y += (wave1 + wave2 + wave3) * uv.y * uIntensity;
    pos.x += sin(pos.y * 0.05 + uTime * 0.6) * 3.0 * uv.y;

    vWave = (wave1 + wave2 + wave3) * 0.1;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const auroraFragmentShader = `
  uniform float uTime;
  uniform float uIntensity;
  varying vec2 vUv;
  varying float vWave;

  void main() {
    // Vertical curtain gradient
    float verticalFade = smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.4, vUv.y);

    // Color gradient across height & wave
    vec3 colorGreen = vec3(0.05, 0.95, 0.65);
    vec3 colorCyan  = vec3(0.1, 0.8, 1.0);
    vec3 colorViolet = vec3(0.7, 0.2, 0.9);

    float t = vUv.y + sin(vUv.x * 8.0 + uTime * 0.5 + vWave) * 0.25;
    vec3 auroraColor = mix(colorGreen, colorCyan, clamp(t * 1.5, 0.0, 1.0));
    auroraColor = mix(auroraColor, colorViolet, clamp((t - 0.5) * 2.0, 0.0, 1.0));

    // Shimmer striations
    float shimmer = 0.7 + 0.3 * sin(vUv.x * 40.0 + uTime * 1.8);
    float alpha = verticalFade * uIntensity * shimmer * 0.85;

    gl_FragColor = vec4(auroraColor, alpha);
  }
`;

export function WeatherEffects() {
    const weather = useGameStore((s) => s.weather);
    const terraforming = useGameStore((s) => s.terraforming);

    const isDustStorm = WeatherService.isDustStorm(weather.type);

    // --- Dust storm particle buffer geometry ---
    const dustGeometry = useMemo(() => {
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(DUST_PARTICLE_COUNT * 3);
        const scales = new Float32Array(DUST_PARTICLE_COUNT);
        const velocities = new Float32Array(DUST_PARTICLE_COUNT * 3);

        const halfX = TERRAIN_BOUNDS.sizeX / 2 + 10;
        const halfZ = TERRAIN_BOUNDS.sizeZ / 2 + 10;

        for (let i = 0; i < DUST_PARTICLE_COUNT; i++) {
            const idx = i * 3;
            positions[idx] = (Math.random() * 2 - 1) * halfX;
            positions[idx + 1] = Math.random() * 25;
            positions[idx + 2] = (Math.random() * 2 - 1) * halfZ;

            scales[i] = 0.5 + Math.random() * 1.5;

            velocities[idx] = 0.8 + Math.random() * 0.5; // X drift
            velocities[idx + 1] = (Math.random() - 0.5) * 0.2; // Y float
            velocities[idx + 2] = 0.4 + Math.random() * 0.4; // Z drift
        }

        geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geo.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
        geo.setAttribute("aVelocity", new THREE.BufferAttribute(velocities, 3));
        return geo;
    }, []);

    // --- Dust Material ---
    const dustMaterial = useMemo(() => {
        return new THREE.ShaderMaterial({
            vertexShader: dustVertexShader,
            fragmentShader: dustFragmentShader,
            uniforms: {
                uTime: { value: 0 },
                uIntensity: { value: 0 },
                uColor: { value: new THREE.Color("#c2804b") },
                uBoundsX: { value: new THREE.Vector2(-TERRAIN_BOUNDS.sizeX / 2 - 10, TERRAIN_BOUNDS.sizeX / 2 + 10) },
                uBoundsZ: { value: new THREE.Vector2(-TERRAIN_BOUNDS.sizeZ / 2 - 10, TERRAIN_BOUNDS.sizeZ / 2 + 10) },
            },
            transparent: true,
            depthWrite: false,
            blending: THREE.NormalBlending,
        });
    }, []);

    // --- Aurora Ribbon Geometry ---
    const auroraGeometry = useMemo(() => {
        // Plane geometry curved along sky horizon
        const geo = new THREE.PlaneGeometry(160, 40, AURORA_RIBBON_SEGMENTS_X, AURORA_RIBBON_SEGMENTS_Y);
        return geo;
    }, []);

    // --- Aurora Shader Material ---
    const auroraMaterial = useMemo(() => {
        return new THREE.ShaderMaterial({
            vertexShader: auroraVertexShader,
            fragmentShader: auroraFragmentShader,
            uniforms: {
                uTime: { value: 0 },
                uIntensity: { value: 0 },
            },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
        });
    }, []);

    // Cleanup resources
    useEffect(() => {
        return () => {
            dustGeometry.dispose();
            dustMaterial.dispose();
            auroraGeometry.dispose();
            auroraMaterial.dispose();
        };
    }, [dustGeometry, dustMaterial, auroraGeometry, auroraMaterial]);

    const dustRef = useRef<THREE.Points>(null);
    const auroraRef = useRef<THREE.Mesh>(null);

    useFrame((state, delta) => {
        const elapsedTime = state.clock.elapsedTime;

        // Animate dust particles
        if (dustMaterial) {
            dustMaterial.uniforms.uTime.value = elapsedTime;
            const targetIntensity = isDustStorm ? weather.intensity : weather.type === "warning" ? 0.25 : 0;
            dustMaterial.uniforms.uIntensity.value = THREE.MathUtils.lerp(
                dustMaterial.uniforms.uIntensity.value,
                targetIntensity,
                delta * 2.5
            );
        }

        // Animate aurora curtains
        if (auroraMaterial) {
            auroraMaterial.uniforms.uTime.value = elapsedTime;
            const targetAurora = weather.type === "polar_aurora"
                ? weather.intensity
                : (terraforming >= 75 ? 0.35 : 0);
            auroraMaterial.uniforms.uIntensity.value = THREE.MathUtils.lerp(
                auroraMaterial.uniforms.uIntensity.value,
                targetAurora,
                delta * 2.0
            );
        }

        if (dustRef.current) {
            dustRef.current.visible = dustMaterial.uniforms.uIntensity.value > 0.01;
        }

        if (auroraRef.current) {
            auroraRef.current.visible = auroraMaterial.uniforms.uIntensity.value > 0.01;
        }
    });

    return (
        <group name="weather-effects">
            <points ref={dustRef} geometry={dustGeometry} material={dustMaterial} />
            <mesh
                ref={auroraRef}
                geometry={auroraGeometry}
                material={auroraMaterial}
                position={[0, 75, -50]}
                rotation={[-0.25, 0, 0]}
            />
        </group>
    );
}
