import { Suspense, useMemo } from "react";
import { useMars } from "./store";
import { useGLTF } from "@react-three/drei";

// cache/preload – możesz dorzucić inne ścieżki
useGLTF.preload("/models/biomass_silo.glb");
useGLTF.preload("/models/energy_station.glb");
useGLTF.preload("/models/greenhouse.glb");
useGLTF.preload("/models/habitat.glb");
useGLTF.preload("/models/solar_panel.glb");

function Model({ path, scale=1 }: { path: string; scale?: number }) {
  const gltf = useGLTF(path) as any;
  return <primitive object={gltf.scene} scale={scale} />;
}

function BuildingMesh({ defId }: { defId: string }) {
  const def = useMars(s=>s.defs[defId]);
  // dopasuj skalę jeśli modele są za duże/małe
  const scale = useMemo(() => {
    switch (defId) {
      case "hab": return 0.8;
      case "greenhouse": return 0.8;
      case "solar": return 1.0;
      case "watertank": return 0.9;
      case "silo": return 0.9;
      case "rtg": return 1.0;
      default: return 1.0;
    }
  }, [defId]);

  if (def?.glbPath) {
    return (
      <Suspense fallback={null}>
        <Model path={def.glbPath} scale={scale} />
      </Suspense>
    );
  }
  // Fallback – stara kostka
  return (
    <mesh>
      <boxGeometry args={[1,1,1]} />
      <meshStandardMaterial color={def?.color ?? "#fff"} />
    </mesh>
  );
}
export function Buildings() {
  const placed = useMars(s=>s.placed);
  return (
    <>
      {placed.map(b => (
        <group key={b.id} position={[b.x, b.y, b.z]}>
          {/* podnieś delikatnie, żeby nie clipował z terenem */}
          <group position={[0, 0.5, 0]}>
            <BuildingMesh defId={b.defId} />
          </group>
        </group>
      ))}
    </>
  );
}

export function HoverGhost() {
  const hover = useMars(s=>s.hover);
  const defId = useMars(s=>s.buildDefId);
  const can = useMars(s=>s.canAfford);
  const placing = useMars(s=>s.buildMode) === 'place';
  if (!hover || !defId || !placing) return null;
  const ok = can(defId);
  return (
    <mesh position={[hover.x, 0.51, hover.z]}>
      <boxGeometry args={[1,1,1]} />
      <meshStandardMaterial color={ok ? "#00ff88" : "#ff3355"} transparent opacity={0.35}/>
    </mesh>
  );
}
