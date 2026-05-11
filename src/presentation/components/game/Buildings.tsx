import { Suspense, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import type { Group } from "three";
import { useGameStore } from "../../../application/store/useGameStore";
import { useUIStore } from "../../../application/store/useUIStore";
import { BUILDING_DEFINITIONS } from "../../../domain/config/buildings";
import { keyFromCell } from "../../../domain/entities/Position";
import { BuildingService } from "../../../domain/services/BuildingService";
import { useTerrainHeight } from "./TerrainHeightContext";

// Preload models
useGLTF.preload("/models/biomass_silo.glb");
useGLTF.preload("/models/energy_station.glb");
useGLTF.preload("/models/greenhouse.glb");
useGLTF.preload("/models/habitat.glb");
useGLTF.preload("/models/solar_panel.glb");

interface ModelProps {
    path: string;
    scale?: number;
}

function Model({ path, scale = 1 }: ModelProps) {
    const gltf = useGLTF(path) as { scene: Group };
    const sceneClone = useMemo<Group>(() => gltf.scene.clone(true), [gltf.scene]);

    return <primitive object={sceneClone} scale={scale} />;
}

interface BuildingMeshProps {
    defId: string;
}

function BuildingMesh({ defId }: BuildingMeshProps) {
    const def = BUILDING_DEFINITIONS[defId];

    const scale = useMemo(() => {
        switch (defId) {
            case "hab": return 0.8;
            case "greenhouse": return 0.8;
            case "solar": return 1.0;
            case "watertank": return 0.9;
            case "silo": return 0.9;
            case "rtg": return 1.0;
            default: return 1.0;
        }
    }, [defId]);

    if (def?.modelPath) {
        return (
            <Suspense fallback={null}>
                <Model path={def.modelPath} scale={scale} />
            </Suspense>
        );
    }

    return (
        <mesh>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={def?.color ?? "#fff"} />
        </mesh>
    );
}

export function Buildings() {
    const placed = useGameStore((state) => state.placed);

    return (
        <>
            {placed.map((b) => (
                <group key={b.id} position={[b.position.x, b.position.y + 0.5, b.position.z]}>
                    <BuildingMesh defId={b.definitionId} />
                </group>
            ))}
        </>
    );
}

export function HoverGhost() {
    const hoverCell = useUIStore((state) => state.hoverCell);
    const selectedBuildingId = useUIStore((state) => state.selectedBuildingId);
    const buildMode = useUIStore((state) => state.buildMode);
    const resources = useGameStore((state) => state.resources);
    const terrainY = useTerrainHeight();

    if (!hoverCell || !selectedBuildingId || buildMode !== "place") return null;

    const def = BUILDING_DEFINITIONS[selectedBuildingId];
    const canAfford = def ? BuildingService.canAfford(def.cost, resources) : false;
    const baseY = terrainY(hoverCell.x, hoverCell.z) + 0.51;

    return (
        <mesh position={[hoverCell.x, baseY, hoverCell.z]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={canAfford ? "#00ff88" : "#ff3355"} transparent opacity={0.35} />
        </mesh>
    );
}

export function DemolishGhost() {
    const hoverCell = useUIStore((state) => state.hoverCell);
    const buildMode = useUIStore((state) => state.buildMode);
    const occupied = useGameStore((state) => state.occupied);
    const terrainY = useTerrainHeight();

    if (!hoverCell || buildMode !== "demolish") return null;

    const key = keyFromCell(hoverCell.x, hoverCell.z);
    const isOccupied = !!occupied[key];

    if (!isOccupied) return null;

    const cx = Math.round(hoverCell.x);
    const cz = Math.round(hoverCell.z);
    const baseY = terrainY(cx, cz) + 0.51;

    return (
        <mesh position={[cx, baseY, cz]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#ff3355" transparent opacity={0.35} />
        </mesh>
    );
}
