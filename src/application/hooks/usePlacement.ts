import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useUIStore } from "../store/useUIStore";
import { useGameStore } from "../store/useGameStore";

const RAY = new THREE.Raycaster();
const MOUSE = new THREE.Vector2();

interface UsePlacementOptions {
  grid?: number;
  getHeightAt?: (x: number, z: number) => number;
}

export function usePlacement({ grid = 1, getHeightAt }: UsePlacementOptions) {
  const { camera, gl } = useThree();
  const setHoverCell = useUIStore((s) => s.setHoverCell);
  const buildMode = useUIStore((s) => s.buildMode);
  const selectedBuildingId = useUIStore((s) => s.selectedBuildingId);
  const placeBuilding = useGameStore((s) => s.placeBuilding);
  const demolishBuilding = useGameStore((s) => s.demolishBuilding);
  const latest = useRef<{ x: number; z: number } | null>(null);

  // Drag vs click detection
  const downPos = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const DRAG_THRESH = 5;

  useEffect(() => {
    const el = gl.domElement;

    function onPointerMove(e: PointerEvent) {
      const rect = el.getBoundingClientRect();
      MOUSE.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      MOUSE.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (downPos.current) {
        const dx = e.clientX - downPos.current.x;
        const dy = e.clientY - downPos.current.y;
        dragging.current = dx * dx + dy * dy > DRAG_THRESH * DRAG_THRESH;
      }
    }

    function onPointerDown(e: PointerEvent) {
      if (e.button !== 0) return;
      downPos.current = { x: e.clientX, y: e.clientY };
      dragging.current = false;
    }

    function onPointerUp(e: PointerEvent) {
      if (e.button !== 0) return;
      const wasDragging = dragging.current;
      downPos.current = null;
      dragging.current = false;

      if (wasDragging || !latest.current || !buildMode) return;

      const { x, z } = latest.current;
      
      // Terrain bounds: x: 100 (from -50 to 50), z: 50 (from -25 to 25)
      const halfX = 50;
      const halfZ = 25;
      if (x < -halfX || x > halfX || z < -halfZ || z > halfZ) return;
      
      if (buildMode === "place") {
        if (!selectedBuildingId) return;
        const y = getHeightAt ? getHeightAt(x, z) : 0;
        // Don't allow building if terrain height is 0 (texture not loaded)
        if (y === 0) return;
        placeBuilding({ x, z }, y, selectedBuildingId);
      } else if (buildMode === "demolish") {
        demolishBuilding({ x, z });
      }
    }

    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointerup", onPointerUp);
    return () => {
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointerup", onPointerUp);
    };
  }, [gl.domElement, buildMode, selectedBuildingId, placeBuilding, demolishBuilding, getHeightAt]);

  useFrame(() => {
    RAY.setFromCamera(MOUSE, camera);
    
    // Use plane intersection at y=0 for base position
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    if (!RAY.ray.intersectPlane(plane, hit)) {
      if (latest.current !== null) {
        setHoverCell(null);
        latest.current = null;
      }
      return;
    }
    
    const x = Math.round(hit.x / grid) * grid;
    const z = Math.round(hit.z / grid) * grid;
    
    // Terrain bounds: x: 100 (from -50 to 50), z: 50 (from -25 to 25)
    const halfX = 50;
    const halfZ = 25;
    if (x < -halfX || x > halfX || z < -halfZ || z > halfZ) {
      // Don't update hoverCell when outside bounds, but keep the last valid position
      return;
    }
    
    if (!latest.current || latest.current.x !== x || latest.current.z !== z) {
      const cell = { x, z };
      latest.current = cell;
      setHoverCell(cell);
    }
  });
}
