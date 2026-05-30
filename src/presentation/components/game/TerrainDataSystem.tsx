import { useFrame } from "@react-three/fiber";
import { useMemo, useEffect } from "react";
import * as THREE from "three";
import { useGameStore } from "../../../application/store/useGameStore";
import { useUIStore } from "../../../application/store/useUIStore";
import { BUILDING_DEFINITIONS } from "../../../domain/config/buildings";

interface TerrainDataSystemProps {
    terrainSize: { x: number; z: number };
    onDataMapCreated: (map: THREE.CanvasTexture) => void;
}

const CANVAS_RES = 256;

function worldToCanvas(wx: number, wz: number, terrainSize: { x: number; z: number }): [number, number] {
    const u = (wx + terrainSize.x / 2) / terrainSize.x;
    const v = (wz + terrainSize.z / 2) / terrainSize.z;
    return [u * CANVAS_RES, v * CANVAS_RES];
}

export function TerrainDataSystem({ terrainSize, onDataMapCreated }: TerrainDataSystemProps) {
    const canvas = useMemo(() => {
        const c = document.createElement("canvas");
        c.width = CANVAS_RES;
        c.height = CANVAS_RES;
        return c;
    }, []);

    const ctx = useMemo(() => canvas.getContext("2d"), [canvas]);

    const texture = useMemo(() => {
        const tex = new THREE.CanvasTexture(canvas);
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        return tex;
    }, [canvas]);

    useEffect(() => {
        onDataMapCreated(texture);
    }, [texture, onDataMapCreated]);

    useFrame(() => {
        if (!ctx) return;

        // Clear transparent
        ctx.clearRect(0, 0, CANVAS_RES, CANVAS_RES);

        const placedBuildings = useGameStore.getState().placed;
        const alienState = useGameStore.getState().alienState;
        const hoverCell = useUIStore.getState().hoverCell;
        const buildMode = useUIStore.getState().buildMode;
        const selectedBuildingId = useUIStore.getState().selectedBuildingId;

        // 1. Building footprints + category colors
        placedBuildings.forEach((b) => {
            const def = BUILDING_DEFINITIONS[b.definitionId];
            const [px, py] = worldToCanvas(b.position.x, b.position.z, terrainSize);
            const size = CANVAS_RES / terrainSize.x * 0.8;

            ctx.fillStyle = def?.color ?? "#ffffff";
            ctx.beginPath();
            ctx.arc(px, py, size, 0, Math.PI * 2);
            ctx.fill();

            // Subtle influence radius glow — varies per building
            const radius = def?.influenceRadius ?? 2;
            const rPx = radius * (CANVAS_RES / terrainSize.x);
            const grad = ctx.createRadialGradient(px, py, size, px, py, rPx);
            grad.addColorStop(0, "rgba(255,255,255,0.04)");
            grad.addColorStop(1, "rgba(255,255,255,0)");
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(px, py, rPx, 0, Math.PI * 2);
            ctx.fill();
        });

        // 2. Hover cell range preview (when placing)
        if (hoverCell && buildMode === "place" && selectedBuildingId) {
            const def = BUILDING_DEFINITIONS[selectedBuildingId];
            const [hx, hy] = worldToCanvas(hoverCell.x, hoverCell.z, terrainSize);
            const size = CANVAS_RES / terrainSize.x * 0.5;

            // Hover dot
            ctx.fillStyle = "rgba(40,200,120,0.25)";
            ctx.beginPath();
            ctx.arc(hx, hy, size, 0, Math.PI * 2);
            ctx.fill();

            // Range ring
            const radius = def?.influenceRadius ?? 2;
            const rPx = radius * (CANVAS_RES / terrainSize.x);

            ctx.strokeStyle = "rgba(40,200,120,0.12)";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(hx, hy, rPx, 0, Math.PI * 2);
            ctx.stroke();
        }

        // 3. Alien invasion danger zones
        if (alienState.groundUnits.length > 0) {
            alienState.groundUnits.forEach((u: { position: { x: number; z: number } }) => {
                const [ax, ay] = worldToCanvas(u.position.x, u.position.z, terrainSize);
                const rPx = 8 * (CANVAS_RES / terrainSize.x);

                const grad = ctx.createRadialGradient(ax, ay, 0, ax, ay, rPx);
                grad.addColorStop(0, "rgba(255,50,50,0.25)");
                grad.addColorStop(1, "rgba(255,50,50,0)");
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(ax, ay, rPx, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        texture.needsUpdate = true;
    });

    return null;
}
