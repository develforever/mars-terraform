/**
 * TacticalCameraBridge.tsx
 *
 * Synchronizes 3D Camera Frustum with Tactical Minimap and calculates
 * Screen-Edge Offscreen Threats (aliens, meteors) using Frustum Culling.
 * Smoothly executes camera pan/focus requests initiated from Minimap or Radar.
 */

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useGameStore } from "../../../application/store/useGameStore";
import { useUIStore, type OffscreenThreatItem } from "../../../application/store/useUIStore";

interface TacticalCameraBridgeProps {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}

export function TacticalCameraBridge({ controlsRef }: TacticalCameraBridgeProps) {
  const { camera, size } = useThree();
  const lastFrustumUpdateTime = useRef(0);
  const lastThreatUpdateTime = useRef(0);
  const tempVec = useRef(new THREE.Vector3());

  // Ground plane intersection helper for frustum corners
  const getGroundIntersection = (ndcX: number, ndcY: number, cam: THREE.Camera): { x: number; z: number } => {
    const ray = new THREE.Ray();
    const v = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(cam);
    ray.origin.copy(cam.position);
    ray.direction.copy(v.sub(cam.position).normalize());

    if (Math.abs(ray.direction.y) > 0.0001) {
      const t = -ray.origin.y / ray.direction.y;
      if (t > 0 && t < 1000) {
        return {
          x: ray.origin.x + ray.direction.x * t,
          z: ray.origin.z + ray.direction.z * t,
        };
      }
    }
    return {
      x: ray.origin.x + ray.direction.x * 120,
      z: ray.origin.z + ray.direction.z * 120,
    };
  };

  useFrame(({ clock }, delta) => {
    const controls = controlsRef.current;
    const uiState = useUIStore.getState();
    const panReq = uiState.cameraPanRequest;

    // ── 1. Smooth Camera Panning ─────────────────────────────────────────────
    if (panReq && controls) {
      const lerpSpeed = Math.min(1, delta * 9);
      const curTarget = controls.target;
      const nextTargetX = THREE.MathUtils.lerp(curTarget.x, panReq.x, lerpSpeed);
      const nextTargetZ = THREE.MathUtils.lerp(curTarget.z, panReq.z, lerpSpeed);

      const dx = nextTargetX - curTarget.x;
      const dz = nextTargetZ - curTarget.z;

      curTarget.x = nextTargetX;
      curTarget.z = nextTargetZ;
      camera.position.x += dx;
      camera.position.z += dz;
      controls.update();

      if (Math.hypot(panReq.x - curTarget.x, panReq.z - curTarget.z) < 0.15) {
        curTarget.x = panReq.x;
        curTarget.z = panReq.z;
        controls.update();
        uiState.clearCameraPanRequest();
      }
    }

    const now = clock.elapsedTime;

    // ── 2. Update Frustum Quad (throttled ~30fps for smooth canvas rendering) ─
    if (now - lastFrustumUpdateTime.current > 0.033) {
      lastFrustumUpdateTime.current = now;

      const p0 = getGroundIntersection(-1, -1, camera); // Bottom-left
      const p1 = getGroundIntersection(1, -1, camera);  // Bottom-right
      const p2 = getGroundIntersection(1, 1, camera);   // Top-right
      const p3 = getGroundIntersection(-1, 1, camera);  // Top-left

      const targetPos = controls
        ? { x: controls.target.x, y: controls.target.y, z: controls.target.z }
        : { x: 0, y: 0, z: 0 };

      uiState.setCameraFrustum([p0, p1, p2, p3], targetPos);
    }

    // ── 3. Detect Offscreen Threats (~20fps for performance) ───────────────────
    if (now - lastThreatUpdateTime.current > 0.05) {
      lastThreatUpdateTime.current = now;

      const gameState = useGameStore.getState();
      const alienState = gameState.alienState;
      const weather = gameState.weather;
      const targetPos = controls ? controls.target : new THREE.Vector3(0, 0, 0);

      const threats: OffscreenThreatItem[] = [];
      const W = size.width;
      const H = size.height;
      const cx = W / 2;
      const cy = H / 2;
      const margin = 42;
      const maxHalfW = Math.max(10, cx - margin);
      const maxHalfH = Math.max(10, cy - margin);

      const checkThreat = (
        id: string,
        type: "alien_ship" | "alien_ground" | "meteor",
        pos: { x: number; y?: number; z: number },
        severity: "warning" | "danger" | "critical" = "danger"
      ) => {
        const py = pos.y ?? 0;
        tempVec.current.set(pos.x, py, pos.z);
        tempVec.current.project(camera);

        const isBehind = tempVec.current.z > 1 || tempVec.current.z < 0;
        let ndcX = tempVec.current.x;
        let ndcY = tempVec.current.y;

        if (isBehind) {
          ndcX = -ndcX;
          ndcY = -ndcY;
        }

        // Check if inside on-screen viewport
        const onScreen =
          !isBehind &&
          ndcX >= -0.88 &&
          ndcX <= 0.88 &&
          ndcY >= -0.88 &&
          ndcY <= 0.88;

        if (!onScreen) {
          // Offscreen: Calculate screen perimeter position
          const angle = Math.atan2(ndcY, ndcX);
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);

          const scale = Math.min(
            Math.abs(cos) > 0.0001 ? maxHalfW / Math.abs(cos) : maxHalfW,
            Math.abs(sin) > 0.0001 ? maxHalfH / Math.abs(sin) : maxHalfH
          );

          const screenX = cx + cos * scale;
          const screenY = cy - sin * scale; // Invert Y for DOM screen space
          const angleRad = Math.atan2(-sin, cos);
          const distanceMeters = Math.round(Math.hypot(pos.x - targetPos.x, pos.z - targetPos.z));

          threats.push({
            id,
            type,
            worldPosition: { x: pos.x, y: py, z: pos.z },
            screenX,
            screenY,
            angleRad,
            distanceMeters,
            severity,
          });
        }
      };

      // Alien Ships
      for (const ship of alienState.ships) {
        if (ship.active !== false) {
          checkThreat(ship.id, "alien_ship", ship.position, "critical");
        }
      }

      // Alien Ground Units
      for (const unit of alienState.groundUnits) {
        if (unit.active !== false) {
          checkThreat(unit.id, "alien_ground", unit.position, "danger");
        }
      }

      // Meteors (during warning or shower)
      if (weather.type === "meteor_warning" && weather.impactZones) {
        weather.impactZones.forEach((zone, idx) => {
          checkThreat(`meteor-zone-${idx}`, "meteor", { x: zone.x, y: 0, z: zone.z }, "warning");
        });
      } else if (weather.type === "meteor_shower" && weather.trajectories) {
        weather.trajectories.forEach((traj, idx) => {
          checkThreat(`meteor-traj-${idx}`, "meteor", { x: traj.targetX, y: traj.targetY, z: traj.targetZ }, "critical");
        });
      }

      uiState.setOffscreenThreats(threats);
    }
  });

  // Clean up on unmount
  useEffect(() => {
    return () => {
      useUIStore.getState().setOffscreenThreats([]);
    };
  }, []);

  return null;
}
