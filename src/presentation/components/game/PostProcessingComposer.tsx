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
    Effect,
} from "postprocessing";

interface PostProcessingComposerProps {
    bloomIntensity?: number;
    bloomThreshold?: number;
    bloomSmoothing?: number;
    glitch?: boolean;
}

export function PostProcessingComposer({
    bloomIntensity = 1.5,
    bloomThreshold = 0.2,
    bloomSmoothing = 0.9,
    glitch = false,
}: PostProcessingComposerProps) {
    const { gl, scene, camera, size } = useThree();
    const composerRef = useRef<EffectComposer | null>(null);

    useEffect(() => {
        const composer = new EffectComposer(gl, {
            multisampling: 8,
        });
        composer.addPass(new RenderPass(scene, camera));

        const bloomEffect = new BloomEffect({
            luminanceThreshold: bloomThreshold,
            luminanceSmoothing: bloomSmoothing,
            intensity: bloomIntensity,
            mipmapBlur: true,
        });

        const toneMappingEffect = new ToneMappingEffect({
            mode: ToneMappingMode.ACES_FILMIC,
        });

        const effects: Effect[] = [bloomEffect, toneMappingEffect];

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
            composer.dispose();
            composerRef.current = null;
        };
    }, [gl, scene, camera, bloomIntensity, bloomThreshold, bloomSmoothing, glitch]);

    useEffect(() => {
        if (composerRef.current && size && size.width > 0 && size.height > 0) {
            composerRef.current.setSize(size.width, size.height);
        }
    }, [size]);

    useFrame((_, delta) => {
        if (composerRef.current) {
            const currentAutoClear = gl.autoClear;
            gl.autoClear = true;
            composerRef.current.render(delta);
            gl.autoClear = currentAutoClear;
        }
    }, 1);

    return null;
}
