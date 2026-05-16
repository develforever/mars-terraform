import { Mesh, type Texture, RepeatWrapping } from "three";
import { forwardRef, useMemo } from "react";
import { TERRAIN_DISPLACEMENT_SCALE } from "../../utils/terrainDisplacement";

interface MarsTerrainProps {
    terrainSize: { x: number; z: number };
    colorMap: Texture;
    displacementMap: Texture;
}

export const MarsTerrain = forwardRef<Mesh, MarsTerrainProps>(
    ({ terrainSize, colorMap, displacementMap }, ref) => {
        useMemo(() => {
            [colorMap, displacementMap].forEach((t) => {
                t.wrapS = t.wrapT = RepeatWrapping;
                t.repeat.set(1, 1);
            });
        }, [colorMap, displacementMap]);

        return (
            <mesh ref={ref} rotation-x={-Math.PI / 2} receiveShadow>
                <planeGeometry args={[terrainSize.x, terrainSize.z, 128, 128]} />
                <meshStandardMaterial
                    map={colorMap}
                    displacementMap={displacementMap}
                    displacementScale={TERRAIN_DISPLACEMENT_SCALE}
                    roughness={0.9}
                    metalness={0.1}
                />
            </mesh>
        );
    }
);

MarsTerrain.displayName = "MarsTerrain";
