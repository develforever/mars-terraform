import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
    EffectComposer,
    RenderPass,
    EffectPass,
    BloomEffect,
    ToneMappingEffect,
    GlitchEffect,
    ToneMappingMode,
    BlendFunction,
    Effect,
    OutlineEffect,
} from "postprocessing";

interface PostProcessingComposerProps {
    bloomIntensity?: number;
    bloomThreshold?: number;
    bloomSmoothing?: number;
    glitch?: boolean;
    outline?: boolean;
    onOutlineReady?: (effect: OutlineEffect | null) => void;
}

export function PostProcessingComposer({
    bloomIntensity = 1.5,
    bloomThreshold = 0.2,
    bloomSmoothing = 0.9,
    glitch = false,
    outline = false,
    onOutlineReady,
}: PostProcessingComposerProps) {
    const { gl, scene, camera, size } = useThree();
    const composerRef = useRef<EffectComposer | null>(null);
    const bloomRef = useRef<BloomEffect | null>(null);

    const onOutlineReadyRef = useRef(onOutlineReady);
    useEffect(() => {
        onOutlineReadyRef.current = onOutlineReady;
    });

    const initBloomPropsRef = useRef({
        bloomIntensity,
        bloomThreshold,
        bloomSmoothing,
    });

    useEffect(() => {
        const composer = new EffectComposer(gl, {
            multisampling: 0,
        });
        composer.addPass(new RenderPass(scene, camera));

        const initProps = initBloomPropsRef.current;
        const bloomEffect = new BloomEffect({
            luminanceThreshold: initProps.bloomThreshold,
            luminanceSmoothing: initProps.bloomSmoothing,
            intensity: initProps.bloomIntensity,
            mipmapBlur: true,
        });
        bloomRef.current = bloomEffect;

        const toneMappingEffect = new ToneMappingEffect({
            mode: ToneMappingMode.ACES_FILMIC,
        });

        const effects: Effect[] = [bloomEffect, toneMappingEffect];

        if (outline) {
            const outlineEffect = new OutlineEffect(scene, camera, {
                blendFunction: BlendFunction.ADD,
                edgeStrength: 5,
                pulseSpeed: 0.0,
                visibleEdgeColor: 0x00ffff,
                hiddenEdgeColor: 0x003333,
                blur: false,
                xRay: false,
            });
            effects.push(outlineEffect);
            onOutlineReadyRef.current?.(outlineEffect);
        }

        if (glitch) {
            effects.push(new GlitchEffect({
                delay: new THREE.Vector2(3.0, 5.0),
                duration: new THREE.Vector2(0.05, 0.15),
                strength: new THREE.Vector2(0.05, 0.15),
                ratio: 0.95,
            }));
        }

        composer.addPass(new EffectPass(camera, ...effects));
        composerRef.current = composer;

        return () => {
            bloomRef.current = null;
            onOutlineReadyRef.current?.(null);
            composer.dispose();
            composerRef.current = null;
        };
    }, [gl, scene, camera, glitch, outline]);

    // Update bloom params without rebuilding the composer
    useEffect(() => {
        if (!bloomRef.current) return;
        bloomRef.current.intensity = bloomIntensity;
    }, [bloomIntensity]);

    useEffect(() => {
        if (!bloomRef.current) return;
        const mat = bloomRef.current.luminancePass.fullscreenMaterial as THREE.ShaderMaterial & {
            threshold: number;
            smoothing: number;
        };
        mat.threshold = bloomThreshold;
        mat.smoothing = bloomSmoothing;
    }, [bloomThreshold, bloomSmoothing]);

    useEffect(() => {
        if (composerRef.current && size.width > 0 && size.height > 0) {
            composerRef.current.setSize(size.width, size.height);
        }
    }, [size]);

    useFrame((_, delta) => {
        if (!composerRef.current) return;
        // autoClear=true needed so RenderPass clears its buffer before rendering
        gl.autoClear = true;
        composerRef.current.render(delta);
    }, 1);

    return null;
}
