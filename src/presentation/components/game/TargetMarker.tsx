import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useTargetMarkerStore, type TargetPing } from "../../../application/store/useTargetMarkerStore";

interface SinglePingProps {
  ping: TargetPing;
}

function SinglePing({ ping }: SinglePingProps) {
  const ringRef = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);

  const color = useMemo(() => {
    if (ping.type === "attack") return "#ef4444";
    if (ping.type === "repair") return "#00e5ff";
    return "#22c55e"; // move (green)
  }, [ping.type]);

  useFrame(() => {
    const elapsed = (Date.now() - ping.createdAt) / 1000;
    const progress = Math.min(1, elapsed / 1.2);
    const opacity = Math.max(0, 1 - progress);

    if (ringRef.current) {
      const scale = 0.5 + progress * 1.8;
      ringRef.current.scale.set(scale, scale, 1);
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      if (mat) mat.opacity = opacity * 0.9;
    }

    if (ring2Ref.current) {
      const scale2 = 0.2 + progress * 1.0;
      ring2Ref.current.scale.set(scale2, scale2, 1);
      const mat2 = ring2Ref.current.material as THREE.MeshBasicMaterial;
      if (mat2) mat2.opacity = opacity * 0.7;
    }
  });

  return (
    <group position={[ping.position[0], ping.position[1] + 0.08, ping.position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
      {/* Outer expanding ring */}
      <mesh ref={ringRef}>
        <ringGeometry args={[0.7, 0.85, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>

      {/* Inner expanding ring */}
      <mesh ref={ring2Ref}>
        <ringGeometry args={[0.3, 0.45, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.7} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>

      {/* Center crosshair / dot */}
      <mesh>
        <circleGeometry args={[0.15, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.8} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export function TargetMarker() {
  const pings = useTargetMarkerStore((state) => state.pings);

  return (
    <>
      {pings.map((ping) => (
        <SinglePing key={ping.id} ping={ping} />
      ))}
    </>
  );
}
