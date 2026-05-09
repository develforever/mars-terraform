import { Mesh, type Texture } from "three";
import { forwardRef } from "react";
import { RepeatWrapping } from "three";
import { TERRAIN_DISPLACEMENT_SCALE } from "../../utils/terrainDisplacement";

interface MarsTerrainProps {
    terrainSize: { x: number; z: number };
    colorMap: Texture;
    displacementMap: Texture;
}

export const MarsTerrain = forwardRef<Mesh, MarsTerrainProps>(
    ({ terrainSize, colorMap, displacementMap }, ref) => {
        [colorMap, displacementMap].forEach((t) => {
            t.wrapS = t.wrapT = RepeatWrapping;
            t.repeat.set(1, 1);
        });

        return (
            <mesh ref={ref} rotation-x={-Math.PI / 2} receiveShadow>
                <planeGeometry args={[terrainSize.x, terrainSize.z, 32, 32]} />
                <meshStandardMaterial
                    map={colorMap}
                    displacementMap={displacementMap}
                    displacementScale={TERRAIN_DISPLACEMENT_SCALE}
                    roughness={1}
                    metalness={0}
                />
            </mesh>
        );
    }
);

MarsTerrain.displayName = "MarsTerrain";
