import { useTexture } from "@react-three/drei";
import { RepeatWrapping } from "three";
import { forwardRef, useMemo } from "react";
import type { Mesh } from "three";

interface MarsProps {
    onClick?: () => void;
}

export const Mars = forwardRef<Mesh, MarsProps>(({ onClick }, ref) => {
    const sphereRadius = 20;

    const [colorMap, dispMap] = useTexture([
        "/textures/mars_colorx1.png",
        "/textures/mars_displacementx1.png",
    ]);

    useMemo(() => {
        [colorMap, dispMap].forEach((t) => {
            t.wrapS = t.wrapT = RepeatWrapping;
            t.repeat.set(1, 1);
        });
    }, [colorMap, dispMap]);

    return (
        <mesh
            ref={ref}
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
