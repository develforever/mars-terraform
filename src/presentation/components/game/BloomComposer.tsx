import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { GlitchPass } from "three/examples/jsm/postprocessing/GlitchPass.js";
import * as THREE from "three";

interface BloomComposerProps {
    luminanceThreshold?: number;
    luminanceSmoothing?: number;
    intensity?: number;
    glitch?: boolean;
}

export function BloomComposer({
    luminanceThreshold = 0.2,
    luminanceSmoothing = 0.9,
    intensity = 1.5,
    glitch = false,
}: BloomComposerProps) {
    const { gl, scene, camera, size } = useThree();
    const composerRef = useRef<EffectComposer | null>(null);

    useEffect(() => {
        const composer = new EffectComposer(gl);
        composer.addPass(new RenderPass(scene, camera));

        const w = size?.width ?? 800;
        const h = size?.height ?? 600;

        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(w, h),
            intensity,
            luminanceSmoothing,
            luminanceThreshold
        );
        composer.addPass(bloomPass);

        if (glitch) {
            composer.addPass(new GlitchPass());
        }

        composer.addPass(new OutputPass());

        composerRef.current = composer;

        return () => {
            composer.dispose();
            composerRef.current = null;
        };
    }, [gl, scene, camera, size, intensity, luminanceSmoothing, luminanceThreshold, glitch]);

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
