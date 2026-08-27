import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useGameStore } from "../../../application/store/useGameStore";
import { useUIStore } from "../../../application/store/useUIStore";
import { useSelectionBoxStore } from "../../../application/store/useSelectionBoxStore";
import { useTargetMarkerStore } from "../../../application/store/useTargetMarkerStore";
import { worldToHex } from "../../generator/hex/HexMath";

export function RTSSceneController() {
  const { camera, gl, scene, raycaster } = useThree();

  const isDragging = useRef(false);
  const startPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasMovedBox = useRef(false);

  useEffect(() => {
    const domElement = gl.domElement;

    // ── Mouse Down (LMB Drag Start) ──────────────────────────────────────────
    const handlePointerDown = (e: PointerEvent) => {
      const buildMode = useUIStore.getState().buildMode;
      if (buildMode !== null) return;
      if (e.button !== 0) return; // Only LMB

      isDragging.current = true;
      hasMovedBox.current = false;
      startPos.current = { x: e.clientX, y: e.clientY };
      useSelectionBoxStore.getState().setBox({
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
        active: false,
      });
    };

    // ── Mouse Move (Drag Marquee Update) ─────────────────────────────────────
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging.current) return;
      const buildMode = useUIStore.getState().buildMode;
      if (buildMode !== null) {
        isDragging.current = false;
        useSelectionBoxStore.getState().resetBox();
        return;
      }

      const dx = Math.abs(e.clientX - startPos.current.x);
      const dy = Math.abs(e.clientY - startPos.current.y);

      if (dx > 6 || dy > 6 || hasMovedBox.current) {
        hasMovedBox.current = true;
        useSelectionBoxStore.getState().setBox({
          currentX: e.clientX,
          currentY: e.clientY,
          active: true,
        });
      }
    };

    // ── Mouse Up (Complete Drag Selection) ───────────────────────────────────
    const handlePointerUp = (e: PointerEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;

      const buildMode = useUIStore.getState().buildMode;
      if (buildMode !== null) {
        useSelectionBoxStore.getState().resetBox();
        return;
      }

      if (hasMovedBox.current) {
        // Selection Box finished
        const rect = domElement.getBoundingClientRect();
        const minX = Math.min(startPos.current.x, e.clientX);
        const maxX = Math.max(startPos.current.x, e.clientX);
        const minY = Math.min(startPos.current.y, e.clientY);
        const maxY = Math.max(startPos.current.y, e.clientY);

        const units = useGameStore.getState().units;
        const selectedIds: string[] = [];
        const tempVec = new THREE.Vector3();

        units.forEach((unit) => {
          tempVec.set(unit.position.x, unit.position.y, unit.position.z);
          tempVec.project(camera);

          // Check if in front of camera
          if (tempVec.z < 1) {
            const screenX = rect.left + (tempVec.x * 0.5 + 0.5) * rect.width;
            const screenY = rect.top + (-tempVec.y * 0.5 + 0.5) * rect.height;

            if (screenX >= minX && screenX <= maxX && screenY >= minY && screenY <= maxY) {
              selectedIds.push(unit.id);
            }
          }
        });

        if (e.shiftKey) {
          const current = useUIStore.getState().selectedUnitIds;
          const merged = Array.from(new Set([...current, ...selectedIds]));
          useUIStore.getState().selectUnits(merged);
        } else {
          useUIStore.getState().selectUnits(selectedIds);
        }
      }

      useSelectionBoxStore.getState().resetBox();
    };

    // ── Right Click (PPM RTS Orders) ─────────────────────────────────────────
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      const selectedUnitIds = useUIStore.getState().selectedUnitIds;
      if (selectedUnitIds.length === 0) return;

      const rect = domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      if (intersects.length === 0) return;

      // Find first valid intersection
      const hit = intersects[0];
      const hitPoint = hit.point;

      // Check if target is an alien or building
      const alienState = useGameStore.getState().alienState;
      const placedBuildings = useGameStore.getState().placed;

      // Check if clicked close to an alien
      let targetAlienId: string | undefined = undefined;
      for (const g of alienState.groundUnits) {
        if (Math.hypot(g.position.x - hitPoint.x, g.position.z - hitPoint.z) < 2.5) {
          targetAlienId = g.id;
          break;
        }
      }
      if (!targetAlienId) {
        for (const s of alienState.ships) {
          if (Math.hypot(s.position.x - hitPoint.x, s.position.z - hitPoint.z) < 5.0) {
            targetAlienId = s.id;
            break;
          }
        }
      }

      // Check if clicked on a building
      let targetBuildingId: string | undefined = undefined;
      if (!targetAlienId) {
        for (const b of placedBuildings) {
          if (Math.hypot(b.position.x - hitPoint.x, b.position.z - hitPoint.z) < 2.0) {
            targetBuildingId = b.id;
            break;
          }
        }
      }

      if (targetAlienId) {
        // Issue ATTACK Order
        useGameStore.getState().issueOrderToUnits(selectedUnitIds, {
          type: "ATTACK",
          targetEntityId: targetAlienId,
          targetPosition: { x: hitPoint.x, y: hitPoint.y, z: hitPoint.z },
        });
        useTargetMarkerStore.getState().addPing([hitPoint.x, hitPoint.y, hitPoint.z], "attack");
      } else if (targetBuildingId) {
        // Issue REPAIR / Move Order
        useGameStore.getState().issueOrderToUnits(selectedUnitIds, {
          type: "REPAIR",
          targetEntityId: targetBuildingId,
          targetPosition: { x: hitPoint.x, y: hitPoint.y, z: hitPoint.z },
        });
        useTargetMarkerStore.getState().addPing([hitPoint.x, hitPoint.y, hitPoint.z], "repair");
      } else {
        // Issue MOVE Order
        const [q, r] = worldToHex(hitPoint.x, hitPoint.z);
        const hexGrid = useGameStore.getState().hexGrid;
        const cell = hexGrid?.getCell(q, r);
        const y = cell ? cell.worldY : hitPoint.y;

        useGameStore.getState().issueOrderToUnits(selectedUnitIds, {
          type: "MOVE",
          targetPosition: { x: hitPoint.x, y, z: hitPoint.z },
        });
        useTargetMarkerStore.getState().addPing([hitPoint.x, y, hitPoint.z], "move");
      }
    };

    domElement.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    domElement.addEventListener("contextmenu", handleContextMenu);

    return () => {
      domElement.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      domElement.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [camera, gl, scene, raycaster]);

  // ── Keyboard Shortcuts (Control Groups 1..9, S - Stop, A - Attack) ──────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1 && num <= 9) {
        if (e.ctrlKey) {
          e.preventDefault();
          const selected = useUIStore.getState().selectedUnitIds;
          if (selected.length > 0) {
            useUIStore.getState().setControlGroup(num, selected);
          }
        } else {
          e.preventDefault();
          useUIStore.getState().selectControlGroup(num);
        }
        return;
      }

      if (e.key === "s" || e.key === "S") {
        const selected = useUIStore.getState().selectedUnitIds;
        if (selected.length > 0) {
          useGameStore.getState().issueOrderToUnits(selected, { type: "STOP" });
        }
      }

      if (e.key === "Escape") {
        useUIStore.getState().clearUnitSelection();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return null;
}
