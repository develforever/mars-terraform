import { useMars } from "../mars3d/store";
import "./HUD.scss";

export function HUD(){
  const { o2, power, water, biomass, buildDefId, setBuildDef, canAfford } = useMars();
  const buttons = [
    { id: "hab", label: "Kapsuła" },
    { id: "greenhouse", label: "Szklarnia" },
    { id: "solar", label: "Panel" }
  ];
  return (
    <div className="hud">
      <div className="bar">
        <span>💨 O₂ {o2.toFixed(1)}</span>
        <span>⚡ {power.toFixed(1)}</span>
        <span>💧 {water.toFixed(1)}</span>
        <span>🧪 {biomass.toFixed(1)}</span>
      </div>
      <div className="build">
        {buttons.map(b=>{
          const active = buildDefId===b.id; const ok = canAfford(b.id);
          return <button key={b.id} className={active?"active":""} disabled={!ok} onClick={()=>setBuildDef(b.id)}>
            {b.label}{ok?"":" (braki)"}
          </button>;
        })}
      </div>
    </div>
  );
}
