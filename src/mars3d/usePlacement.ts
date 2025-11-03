import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMars } from "./store";

const RAY = new THREE.Raycaster();
const MOUSE = new THREE.Vector2();
const UP = new THREE.Vector3(0,1,0);

export function usePlacement({ grid=1, getHeightAt }: { grid?: number; getHeightAt?: (x:number,z:number)=>number }) {
  const { camera, gl } = useThree();
  const setHover = useMars(s=>s.setHover);
  const placeAt = useMars(s=>s.placeAt);
  const demolishAt = useMars(s=>s.demolishAt);
  const buildMode = useMars(s=>s.buildMode);
  const plane = useRef(new THREE.Plane(UP, 0));
  const latest = useRef<{x:number; z:number} | null>(null);

  // do wykrywania drag vs click
  const downPos = useRef<{x:number; y:number} | null>(null);
  const dragging = useRef(false);
  const DRAG_THRESH = 5; // px

  useEffect(() => {
    const el = gl.domElement;

    function onPointerMove(e: PointerEvent) {
      const rect = el.getBoundingClientRect();
      MOUSE.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      MOUSE.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (downPos.current) {
        const dx = e.clientX - downPos.current.x;
        const dy = e.clientY - downPos.current.y;
        dragging.current = (dx*dx + dy*dy) > (DRAG_THRESH*DRAG_THRESH);
      }
    }

    function onPointerDown(e: PointerEvent) {
      if (e.button !== 0) return; // tylko LPM
      downPos.current = { x: e.clientX, y: e.clientY };
      dragging.current = false;
    }

    function onPointerUp(e: PointerEvent) {
      if (e.button !== 0) return;
      const wasDragging = dragging.current;
      downPos.current = null;
      dragging.current = false;

      // tylko klik na canvasie, bez drag i gdy jest tryb budowy
      if (wasDragging || !latest.current || !buildMode) return;

      const { x, z } = latest.current;
      if (buildMode === 'place') {
        const y = getHeightAt ? getHeightAt(x, z) : 0;
        placeAt({ x, z }, y);
      } else if (buildMode === 'demolish') {
        demolishAt({ x, z });
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
  }, [gl.domElement, buildMode, placeAt, demolishAt, getHeightAt]);

  useFrame(() => {
    RAY.setFromCamera(MOUSE, camera);
    const hit = new THREE.Vector3();
    if (!RAY.ray.intersectPlane(plane.current, hit)) {
      setHover(null); latest.current = null; return;
    }
    const x = Math.round(hit.x / grid) * grid;
    const z = Math.round(hit.z / grid) * grid;
    const cell = { x, z }; latest.current = cell;
    setHover(cell);
  });
}
