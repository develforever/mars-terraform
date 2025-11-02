import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMars } from "./store";

const RAY = new THREE.Raycaster(); const MOUSE = new THREE.Vector2(); const UP = new THREE.Vector3(0,1,0);

export function usePlacement({ grid=1, getHeightAt }: { grid?: number; getHeightAt?: (x:number,z:number)=>number }) {
  const { camera, gl } = useThree();
  const setHover = useMars(s=>s.setHover);
  const placeAt = useMars(s=>s.placeAt);
  const buildId = useMars(s=>s.buildDefId);
  const plane = useRef(new THREE.Plane(UP, 0));
  const latest = useRef<{x:number; z:number} | null>(null);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const rect = gl.domElement.getBoundingClientRect();
      MOUSE.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      MOUSE.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }
    function onClick() {
      if (!latest.current || !buildId) return;
      const { x, z } = latest.current;
      const y = getHeightAt ? getHeightAt(x, z) : 0;
      placeAt({ x, z }, y);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("click", onClick);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("click", onClick); };
  }, [gl.domElement, buildId, placeAt, getHeightAt]);

  useFrame(() => {
    RAY.setFromCamera(MOUSE, camera);
    const hit = new THREE.Vector3();
    if (!RAY.ray.intersectPlane(plane.current, hit)) { setHover(null); latest.current = null; return; }
    const x = Math.round(hit.x / grid) * grid; const z = Math.round(hit.z / grid) * grid;
    const cell = { x, z }; latest.current = cell; setHover(cell);
  });
}
