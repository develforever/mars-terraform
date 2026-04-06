import { Grid } from "@react-three/drei";

interface GridOverlayProps {
    terrainSize: { x: number; z: number };
}

export function GridOverlay({ terrainSize }: GridOverlayProps) {
    return (
        <Grid
            position={[0, 0.06, 0]}
            args={[terrainSize.x, terrainSize.z]}
            cellSize={1}
            cellThickness={0.4}
            cellColor="#6f6f6f"
            sectionSize={5}
            sectionThickness={1}
            sectionColor="#ff5c1a"
            fadeDistance={60}
            infiniteGrid
        />
    );
}
