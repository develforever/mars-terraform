/**
 * TacticalMinimap.tsx
 *
 * Tactical 2D Canvas Minimap for Mars Terraform.
 * Features:
 * - Real-time terrain contours & animated water level coastline
 * - Player buildings categorized by function (Defense, Production, Living)
 * - Natural resource deposit markers (minerals, ice, organics, energy)
 * - RTS friendly units & selected highlights
 * - Hostile alien units with pulsating danger radar pings
 * - Dynamic Camera Frustum Viewport Quad (Trapezoid) & Center Reticle
 * - Interactive click & drag camera panning
 * - Collapsible container, coordinates HUD, and close button adhering to dismiss rules
 */

import { useRef, useEffect, useCallback, useMemo, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { useGameStore } from "../../../application/store/useGameStore";
import { useUIStore } from "../../../application/store/useUIStore";
import { BUILDING_DEFINITIONS, BuildingCategory } from "../../../domain/config/buildings";
import { hexToWorld } from "../../generator/hex/HexMath";
import { TERRAIN_BOUNDS } from "../../utils/terrainBounds";

const MINIMAP_WIDTH = 220;
const MINIMAP_HEIGHT = 160;

// World bounds for mapping
const BOUNDS = {
  minX: -TERRAIN_BOUNDS.halfX - 5,
  maxX: TERRAIN_BOUNDS.halfX + 5,
  minZ: -TERRAIN_BOUNDS.halfZ - 5,
  maxZ: TERRAIN_BOUNDS.halfZ + 5,
};

const WORLD_WIDTH = BOUNDS.maxX - BOUNDS.minX;
const WORLD_HEIGHT = BOUNDS.maxZ - BOUNDS.minZ;

export function TacticalMinimap() {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDragging = useRef(false);

  const isMinimapVisible = useUIStore((s) => s.isMinimapVisible);
  const isMinimapExpanded = useUIStore((s) => s.isMinimapExpanded);
  const toggleMinimapExpanded = useUIStore((s) => s.toggleMinimapExpanded);
  const setMinimapVisible = useUIStore((s) => s.setMinimapVisible);
  const requestCameraPan = useUIStore((s) => s.requestCameraPan);
  const cameraFrustumPoints = useUIStore((s) => s.cameraFrustumPoints);
  const cameraTarget = useUIStore((s) => s.cameraTarget);
  const selectedUnitIds = useUIStore((s) => s.selectedUnitIds);

  const hexGrid = useGameStore((s) => s.hexGrid);
  const waterLevel = useGameStore((s) => s.waterLevel);
  const placedBuildings = useGameStore((s) => s.placed);
  const resourceNodes = useGameStore((s) => s.resourceNodes);
  const units = useGameStore((s) => s.units);
  const alienState = useGameStore((s) => s.alienState);

  // Map building definitions to category for quick lookup
  const buildingCategoryMap = useMemo(() => {
    const map = new Map<string, string>();
    Object.values(BUILDING_DEFINITIONS).forEach((def) => {
      map.set(def.id, def.category);
    });
    return map;
  }, []);

  // Coordinate Conversion Helpers
  const worldToCanvas = useCallback((wx: number, wz: number): [number, number] => {
    const cx = ((wx - BOUNDS.minX) / WORLD_WIDTH) * MINIMAP_WIDTH;
    const cy = ((wz - BOUNDS.minZ) / WORLD_HEIGHT) * MINIMAP_HEIGHT;
    return [cx, cy];
  }, []);

  const canvasToWorld = useCallback((cx: number, cy: number): [number, number] => {
    const wx = BOUNDS.minX + (cx / MINIMAP_WIDTH) * WORLD_WIDTH;
    const wz = BOUNDS.minZ + (cy / MINIMAP_HEIGHT) * WORLD_HEIGHT;
    return [
      Math.max(BOUNDS.minX, Math.min(BOUNDS.maxX, wx)),
      Math.max(BOUNDS.minZ, Math.min(BOUNDS.maxZ, wz)),
    ];
  }, []);

  // Handle pointer interactions on minimap
  const handlePointerAction = useCallback(
    (e: PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const [wx, wz] = canvasToWorld(clickX, clickY);
      requestCameraPan({ x: wx, z: wz });
    },
    [canvasToWorld, requestCameraPan]
  );

  const handlePointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    isDragging.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    handlePointerAction(e);
  };

  const handlePointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging.current) return;
    handlePointerAction(e);
  };

  const handlePointerUp = (e: PointerEvent<HTMLCanvasElement>) => {
    isDragging.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {
      // Ignored
    }
  };

  // 2D Canvas Render Loop
  useEffect(() => {
    if (!isMinimapVisible || !isMinimapExpanded) return;

    let animFrameId: number;

    const render = (time: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // ── Clear Background ───────────────────────────────────────────────────
      ctx.fillStyle = "#120a08";
      ctx.fillRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

      // ── 1. Render Hex Grid Terrain & Water ─────────────────────────────────
      if (hexGrid) {
        // Render hex cells
        const cells = hexGrid.getAllCells();
        for (let i = 0; i < cells.length; i++) {
          const cell = cells[i];
          const [wx, wz] = hexToWorld(cell.q, cell.r);
          const [cx, cy] = worldToCanvas(wx, wz);

          if (cx < -5 || cx > MINIMAP_WIDTH + 5 || cy < -5 || cy > MINIMAP_HEIGHT + 5) continue;

          const isUnderwater = cell.worldY <= waterLevel;

          if (isUnderwater) {
            ctx.fillStyle = "#1e3a8a"; // Deep Water Blue
          } else {
            // Elevation shading
            const y = cell.worldY;
            if (y > 2.5) {
              ctx.fillStyle = "#9a3412"; // Highland
            } else if (y > 1.0) {
              ctx.fillStyle = "#7c2d12"; // Plains
            } else {
              ctx.fillStyle = "#431407"; // Lowland / Crater
            }
          }

          ctx.beginPath();
          ctx.arc(cx, cy, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // ── 2. Render Resource Deposits ────────────────────────────────────────
      for (const node of resourceNodes) {
        const [wx, wz] = hexToWorld(node.pos[0], node.pos[1]);
        const [cx, cy] = worldToCanvas(wx, wz);

        switch (node.type) {
          case "minerals":
            ctx.fillStyle = "#f97316"; // Orange
            break;
          case "ice":
            ctx.fillStyle = "#38bdf8"; // Cyan
            break;
          case "organics":
            ctx.fillStyle = "#22c55e"; // Green
            break;
          case "energy":
            ctx.fillStyle = "#eab308"; // Yellow
            break;
          default:
            ctx.fillStyle = "#cbd5e1";
        }

        ctx.beginPath();
        ctx.arc(cx, cy, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── 3. Render Player Buildings ─────────────────────────────────────────
      for (const b of placedBuildings) {
        const [cx, cy] = worldToCanvas(b.position.x, b.position.z);
        const cat = buildingCategoryMap.get(b.definitionId);

        if (cat === BuildingCategory.DEFENSE) {
          ctx.fillStyle = "#ef4444"; // Red / Defense
        } else if (cat === BuildingCategory.PRODUCTION) {
          ctx.fillStyle = "#06b6d4"; // Cyan / Production
        } else if (cat === BuildingCategory.LIVING) {
          ctx.fillStyle = "#3b82f6"; // Blue / Living
        } else {
          ctx.fillStyle = "#a855f7"; // Purple
        }

        // Draw small square for building
        ctx.fillRect(cx - 2.5, cy - 2.5, 5, 5);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 0.6;
        ctx.strokeRect(cx - 2.5, cy - 2.5, 5, 5);
      }

      // ── 4. Render Allied Player Units ──────────────────────────────────────
      for (const u of units) {
        const [cx, cy] = worldToCanvas(u.position.x, u.position.z);
        const isSelected = selectedUnitIds.includes(u.id);

        if (isSelected) {
          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(cx, cy, 4, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.fillStyle = "#10b981"; // Green Unit
        ctx.beginPath();
        ctx.arc(cx, cy, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── 5. Render Hostile Alien Units & Ships (Red Pulsing) ─────────────────
      const pulse = 1.8 + Math.sin(time * 0.008) * 1.2;
      const wavePulse = (time * 0.005) % 1;

      // Alien Ships
      for (const ship of alienState.ships) {
        if (ship.active === false) continue;
        const [cx, cy] = worldToCanvas(ship.position.x, ship.position.z);

        // Danger Radar Ping Wave
        ctx.strokeStyle = `rgba(239, 68, 68, ${1 - wavePulse})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, 3 + wavePulse * 7, 0, Math.PI * 2);
        ctx.stroke();

        // Ship Dot
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(cx, cy, pulse + 1.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Alien Ground Units
      for (const g of alienState.groundUnits) {
        if (g.active === false) continue;
        const [cx, cy] = worldToCanvas(g.position.x, g.position.z);

        ctx.fillStyle = "#dc2626";
        ctx.beginPath();
        ctx.arc(cx, cy, pulse, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── 6. Render Camera Frustum Box (Trapezoid) ───────────────────────────
      if (cameraFrustumPoints && cameraFrustumPoints.length === 4) {
        const c0 = worldToCanvas(cameraFrustumPoints[0].x, cameraFrustumPoints[0].z);
        const c1 = worldToCanvas(cameraFrustumPoints[1].x, cameraFrustumPoints[1].z);
        const c2 = worldToCanvas(cameraFrustumPoints[2].x, cameraFrustumPoints[2].z);
        const c3 = worldToCanvas(cameraFrustumPoints[3].x, cameraFrustumPoints[3].z);

        ctx.beginPath();
        ctx.moveTo(c0[0], c0[1]);
        ctx.lineTo(c1[0], c1[1]);
        ctx.lineTo(c2[0], c2[1]);
        ctx.lineTo(c3[0], c3[1]);
        ctx.closePath();

        ctx.fillStyle = "rgba(6, 182, 212, 0.15)";
        ctx.fill();

        ctx.strokeStyle = "#22d3ee";
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      // ── 7. Render Camera Target Reticle ────────────────────────────────────
      if (cameraTarget) {
        const [tx, ty] = worldToCanvas(cameraTarget.x, cameraTarget.z);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;

        // Crosshair
        ctx.beginPath();
        ctx.moveTo(tx - 3, ty);
        ctx.lineTo(tx + 3, ty);
        ctx.moveTo(tx, ty - 3);
        ctx.lineTo(tx, ty + 3);
        ctx.stroke();
      }

      // ── 8. Minimap Grid Overlay Border ─────────────────────────────────────
      ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, MINIMAP_WIDTH - 1, MINIMAP_HEIGHT - 1);

      animFrameId = requestAnimationFrame(render);
    };

    animFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameId);
  }, [
    isMinimapVisible,
    isMinimapExpanded,
    hexGrid,
    waterLevel,
    placedBuildings,
    resourceNodes,
    units,
    alienState,
    cameraFrustumPoints,
    cameraTarget,
    selectedUnitIds,
    worldToCanvas,
    buildingCategoryMap,
  ]);

  if (!isMinimapVisible) return null;

  return (
    <aside
      aria-label="Tactical Minimap"
      className="tactical-minimap-panel"
      style={{
        position: "fixed",
        right: "16px",
        bottom: "80px",
        zIndex: 50,
        backgroundColor: "rgba(15, 23, 42, 0.92)",
        backdropFilter: "blur(8px)",
        border: "1px solid rgba(56, 189, 248, 0.4)",
        borderRadius: "8px",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.6), 0 0 12px rgba(56, 189, 248, 0.15)",
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "5px 8px",
          backgroundColor: "rgba(30, 41, 59, 0.9)",
          borderBottom: isMinimapExpanded ? "1px solid rgba(56, 189, 248, 0.3)" : "none",
          fontSize: "11px",
          color: "#94a3b8",
          fontFamily: "monospace",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ color: "#38bdf8", fontWeight: "bold" }}>📡 {t("hud.minimap")}</span>
          {cameraTarget && (
            <span style={{ color: "#64748b", fontSize: "10px" }}>
              [{Math.round(cameraTarget.x)}, {Math.round(cameraTarget.z)}]
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <button
            type="button"
            onClick={toggleMinimapExpanded}
            style={{
              background: "none",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              padding: "0 4px",
              fontSize: "10px",
            }}
            title={isMinimapExpanded ? t("hud.minimapCollapse") : t("hud.minimapExpand")}
          >
            {isMinimapExpanded ? "▼" : "▲"}
          </button>
          <button
            type="button"
            onClick={() => setMinimapVisible(false)}
            style={{
              background: "none",
              border: "none",
              color: "#ef4444",
              cursor: "pointer",
              padding: "0 4px",
              fontSize: "12px",
              fontWeight: "bold",
            }}
            title={t("hud.minimapClose")}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Minimap 2D Canvas */}
      {isMinimapExpanded && (
        <div style={{ position: "relative", width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}>
          <canvas
            ref={canvasRef}
            width={MINIMAP_WIDTH}
            height={MINIMAP_HEIGHT}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            style={{
              display: "block",
              cursor: "crosshair",
              touchAction: "none",
            }}
          />
          {/* Legend Overlay */}
          <div
            style={{
              position: "absolute",
              bottom: "4px",
              left: "4px",
              display: "flex",
              gap: "6px",
              fontSize: "9px",
              color: "#94a3b8",
              backgroundColor: "rgba(15, 23, 42, 0.75)",
              padding: "2px 4px",
              borderRadius: "3px",
              pointerEvents: "none",
            }}
          >
            <span style={{ color: "#ef4444" }}>● {t("hud.minimapDefense")}</span>
            <span style={{ color: "#06b6d4" }}>● {t("hud.minimapProduction")}</span>
            <span style={{ color: "#10b981" }}>● {t("hud.minimapUnits")}</span>
          </div>
        </div>
      )}
    </aside>
  );
}
