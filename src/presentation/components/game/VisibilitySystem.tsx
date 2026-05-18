import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useGameStore } from "../../../application/store/useGameStore";
import { useUIStore } from "../../../application/store/useUIStore";
import { BUILDING_DEFINITIONS } from "../../../domain/config/buildings";

interface VisibilitySystemProps {
    terrainSize: { x: number; z: number };
    onVisibilityMapCreated: (map: THREE.CanvasTexture) => void;
}

export function VisibilitySystem({ terrainSize, onVisibilityMapCreated }: VisibilitySystemProps) {
    const placedBuildings = useGameStore((state) => state.placed);
    const hoverCell = useUIStore((state) => state.hoverCell);
    const buildMode = useUIStore((state) => state.buildMode);
    
    // Create canvas for visibility map
    const canvas = useMemo(() => {
        const can = document.createElement("canvas");
        can.width = 128;
        can.height = 128;
        return can;
    }, []);

    const ctx = useMemo(() => canvas.getContext("2d"), [canvas]);
    
    const visibilityMap = useMemo(() => {
        const tex = new THREE.CanvasTexture(canvas);
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        return tex;
    }, [canvas]);

    // Notify parent about the created map
    useEffect(() => {
        onVisibilityMapCreated(visibilityMap);
    }, [visibilityMap, onVisibilityMapCreated]);

    useFrame(() => {
        if (!ctx) return;

        // 1. Clear with "fog" (darkness)
        ctx.fillStyle = "rgba(0, 0, 0, 0.05)"; // Gradual fade for discovery persistence if needed, but here we want active visibility
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Use globalCompositeOperation to 'add' light
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.globalCompositeOperation = "screen";
        
        placedBuildings.forEach((b) => {
            const def = BUILDING_DEFINITIONS[b.id] || BUILDING_DEFINITIONS[b.definitionId];
            
            // Calculate UV coordinates from world coordinates
            const u = (b.position.x + terrainSize.x / 2) / terrainSize.x;
            const v = (b.position.z + terrainSize.z / 2) / terrainSize.z;
            
            const px = u * canvas.width;
            const py = v * canvas.height;
            
            // Determine visibility radius
            let radius = 15; // Default
            if (def?.category === "living") radius = 25;
            if (def?.category === "defense") radius = 35;
            if (def?.category === "production") radius = 20;
            
            // Draw a gradient light circle
            const gradient = ctx.createRadialGradient(px, py, 0, px, py, radius * (canvas.width / terrainSize.x));
            gradient.addColorStop(0, "rgba(255, 255, 255, 1.0)");
            gradient.addColorStop(0.4, "rgba(255, 255, 255, 0.8)");
            gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(px, py, radius * (canvas.width / terrainSize.x), 0, Math.PI * 2);
            ctx.fill();
        });

        // 3. Add light from building ghost
        if (hoverCell && buildMode === "place") {
            const u = (hoverCell.x + terrainSize.x / 2) / terrainSize.x;
            const v = (hoverCell.z + terrainSize.z / 2) / terrainSize.z;
            const px = u * canvas.width;
            const py = v * canvas.height;
            const radius = 10;

            const gradient = ctx.createRadialGradient(px, py, 0, px, py, radius * (canvas.width / terrainSize.x));
            gradient.addColorStop(0, "rgba(255, 255, 255, 0.8)");
            gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(px, py, radius * (canvas.width / terrainSize.x), 0, Math.PI * 2);
            ctx.fill();
        }

        visibilityMap.needsUpdate = true;
    });

    return null;
}
