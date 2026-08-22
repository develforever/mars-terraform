import { useMemo, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGameStore } from "../../../application/store/useGameStore";
import { BUILDING_DEFINITIONS } from "../../../domain/config/buildings";
import {
  BuildingConnectionService,
  type BuildingConnection,
} from "../../../domain/services/BuildingConnectionService";
import { useTerrainHeight } from "./TerrainHeightContext";
import { hexToWorld } from "../../generator/hex/HexMath";

interface PowerLineProps {
  start: THREE.Vector3;
  end: THREE.Vector3;
  seed: number;
}

const PowerLine = ({ start, end, seed }: PowerLineProps) => {
  const sheathMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const coreMatRef = useRef<THREE.MeshStandardMaterial>(null);

  const { outerGeo, coreGeo } = useMemo(() => {
    const mid = new THREE.Vector3(
      (start.x + end.x) / 2,
      Math.max(start.y, end.y) + 0.6,
      (start.z + end.z) / 2
    );
    const curve = new THREE.CatmullRomCurve3([start, mid, end]);
    return {
      outerGeo: new THREE.TubeGeometry(curve, 16, 0.06, 8, false),
      coreGeo: new THREE.TubeGeometry(curve, 16, 0.025, 6, false),
    };
  }, [start, end]);

  useEffect(() => {
    return () => {
      outerGeo.dispose();
      coreGeo.dispose();
    };
  }, [outerGeo, coreGeo]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (coreMatRef.current) {
      coreMatRef.current.emissiveIntensity =
        2.0 + Math.sin(t * 6 + seed) * 0.8;
    }
    if (sheathMatRef.current) {
      sheathMatRef.current.opacity =
        0.5 + Math.sin(t * 3.5 + seed) * 0.2;
    }
  });

  return (
    <group>
      {/* Outer energy conduit sheath */}
      <mesh geometry={outerGeo}>
        <meshStandardMaterial
          ref={sheathMatRef}
          color="#38bdf8"
          emissive="#0284c7"
          emissiveIntensity={0.8}
          transparent
          opacity={0.55}
          roughness={0.1}
          metalness={0.2}
        />
      </mesh>

      {/* High-intensity glowing energy core */}
      <mesh geometry={coreGeo}>
        <meshStandardMaterial
          ref={coreMatRef}
          color="#ffffff"
          emissive="#7dd3fc"
          emissiveIntensity={2.2}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
};

interface WaterPipeProps {
  start: THREE.Vector3;
  end: THREE.Vector3;
  midY: number;
  seed: number;
}

const WaterPipe = ({ start, end, midY, seed }: WaterPipeProps) => {
  const fluidMatRef = useRef<THREE.MeshStandardMaterial>(null);

  const { casingGeo, fluidGeo, jointA, jointB } = useMemo(() => {
    const mid = new THREE.Vector3(
      (start.x + end.x) / 2,
      midY,
      (start.z + end.z) / 2
    );
    const curve = new THREE.CatmullRomCurve3([start, mid, end]);

    const casing = new THREE.TubeGeometry(curve, 16, 0.11, 10, false);
    const fluid = new THREE.TubeGeometry(curve, 16, 0.065, 8, false);

    // Connector joint rings at endpoints
    const ringA = new THREE.CylinderGeometry(0.16, 0.16, 0.25, 12);
    const ringB = new THREE.CylinderGeometry(0.16, 0.16, 0.25, 12);

    return {
      casingGeo: casing,
      fluidGeo: fluid,
      jointA: ringA,
      jointB: ringB,
    };
  }, [start, end, midY]);

  useEffect(() => {
    return () => {
      casingGeo.dispose();
      fluidGeo.dispose();
      jointA.dispose();
      jointB.dispose();
    };
  }, [casingGeo, fluidGeo, jointA, jointB]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (fluidMatRef.current) {
      fluidMatRef.current.emissiveIntensity =
        0.7 + Math.sin(t * 3.0 + seed) * 0.35;
    }
  });

  return (
    <group>
      {/* Industrial metallic casing */}
      <mesh geometry={casingGeo} castShadow receiveShadow>
        <meshStandardMaterial
          color="#334155"
          roughness={0.35}
          metalness={0.8}
        />
      </mesh>

      {/* Internal flowing pressurized water beam */}
      <mesh geometry={fluidGeo}>
        <meshStandardMaterial
          ref={fluidMatRef}
          color="#0284c7"
          emissive="#38bdf8"
          emissiveIntensity={0.8}
          transparent
          opacity={0.7}
          roughness={0.15}
        />
      </mesh>

      {/* Structural connection flanges */}
      <mesh position={start} geometry={jointA}>
        <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={end} geometry={jointB}>
        <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  );
};

export const BuildingConnections = () => {
  const placed = useGameStore((s) => s.placed);
  const terrainY = useTerrainHeight();

  const connections = useMemo<BuildingConnection[]>(() => {
    return BuildingConnectionService.getGridConnections(
      placed,
      BUILDING_DEFINITIONS,
      4
    );
  }, [placed]);

  if (connections.length === 0) return null;

  return (
    <group name="building-connections">
      {connections.map((conn, index) => {
        const [x1, z1] = hexToWorld(conn.fromHex[0], conn.fromHex[1]);
        const [x2, z2] = hexToWorld(conn.toHex[0], conn.toHex[1]);

        if (conn.type === "power") {
          // Elevated power transmission lines attached to high socket
          const y1 = terrainY(x1, z1) + 1.2;
          const y2 = terrainY(x2, z2) + 1.2;
          const start = new THREE.Vector3(x1, y1, z1);
          const end = new THREE.Vector3(x2, y2, z2);

          return (
            <PowerLine
              key={conn.id}
              start={start}
              end={end}
              seed={index * 1.618}
            />
          );
        }

        // Low-profile terrain-following water pipelines
        const y1 = terrainY(x1, z1) + 0.35;
        const y2 = terrainY(x2, z2) + 0.35;
        const midX = (x1 + x2) / 2;
        const midZ = (z1 + z2) / 2;
        const midY = terrainY(midX, midZ) + 0.35;

        const start = new THREE.Vector3(x1, y1, z1);
        const end = new THREE.Vector3(x2, y2, z2);

        return (
          <WaterPipe
            key={conn.id}
            start={start}
            end={end}
            midY={midY}
            seed={index * 2.718}
          />
        );
      })}
    </group>
  );
};
