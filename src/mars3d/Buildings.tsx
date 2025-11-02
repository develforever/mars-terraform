import { useMars } from "./store";

export function Buildings(){
  const placed = useMars(s=>s.placed);
  const defs = useMars(s=>s.defs);
  return (
    <>
      {placed.map(b=>{
        const color = defs[b.defId]?.color ?? "#fff";
        return (
          <mesh key={b.id} position={[b.x, b.y + 0.5, b.z]} castShadow>
            <boxGeometry args={[1,1,1]} />
            <meshStandardMaterial color={color} />
          </mesh>
        );
      })}
    </>
  );
}

export function HoverGhost(){
  const hover = useMars(s=>s.hover);
  const defId = useMars(s=>s.buildDefId);
  const can = useMars(s=>s.canAfford);
  if (!hover || !defId) return null;
  const ok = can(defId);
  return (
    <mesh position={[hover.x, 0.51, hover.z]}>
      <boxGeometry args={[1,1,1]} />
      <meshStandardMaterial color={ok ? "#00ff88" : "#ff3355"} transparent opacity={0.5}/>
    </mesh>
  );
}
