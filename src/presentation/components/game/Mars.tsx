import { useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { RepeatWrapping } from "three";
import { forwardRef, useMemo, useRef, useImperativeHandle } from "react";
import type { Mesh } from "three";

interface MarsProps {
    onClick?: () => void;
}

export const Mars = forwardRef<Mesh, MarsProps>(({ onClick }, forwardedRef) => {
    const sphereRadius = 20;
    const localRef = useRef<Mesh>(null);

    useImperativeHandle(forwardedRef, () => localRef.current!);

    const [colorMap, dispMap] = useTexture([
        "/textures/2k_mars.jpg",
        "/textures/2k_mars_displacement.jpg",
    ]);

    useMemo(() => {
        [colorMap, dispMap].forEach((t) => {
            t.wrapS = t.wrapT = RepeatWrapping;
            t.repeat.set(1, 1);
        });
    }, [colorMap, dispMap]);

    // Obrót wokół własnej osi
    useFrame((_, delta) => {
        if (localRef.current) {
            localRef.current.rotation.y += delta * 0.05;
        }
    });

    return (
        <mesh
            ref={localRef}
            receiveShadow
            onClick={(e) => {
                e.stopPropagation();
                onClick?.();
            }}
        >
            <sphereGeometry args={[sphereRadius, 128, 128]} />
            <meshStandardMaterial
                map={colorMap}
                displacementMap={dispMap}
                displacementScale={0.6}
                roughness={1}
                metalness={0}
            />
        </mesh>
    );
});

Mars.displayName = "Mars";
