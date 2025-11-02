import { useMars } from "../mars3d/store";
import "./HUD.scss";

export function HUD(){
  const { o2, power, water, biomass, cap, buildDefId, setBuildDef, canAfford, sun, alive } = useMars();
  const buttons = [
    { id: "hab", label: "Kapsuła" },
    { id: "greenhouse", label: "Szklarnia" },
    { id: "solar", label: "Panel" },
    { id: "ice", label: "Kolektor" },
    { id: "battery", label: "Mag. energii" },
    { id: "watertank", label: "Zbiornik" },
    { id: "silo", label: "Silos" },
    { id: "recycler", label: "Recykler" },
    { id: "rtg", label: "RTG" }
  ];

  return (
    <div className="hud">
      <div className="bar">
        <span>☀️ {sun.toFixed(2)}</span>
        <span>💨 O₂ {o2.toFixed(1)}</span>
        <span>⚡ {power.toFixed(1)} / {cap.power}</span>
        <span>💧 {water.toFixed(1)} / {cap.water}</span>
        <span>🧪 {biomass.toFixed(1)} / {cap.biomass}</span>
      </div>

      <div className="build">
        {buttons.map(b=>{
          const active = buildDefId===b.id; const ok = canAfford(b.id);
          return <button key={b.id} className={active?"active":""} disabled={!ok} onClick={()=>setBuildDef(b.id)}>
            {b.label}{ok?"":" (braki)"}
          </button>;
        })}
      </div>

      {!alive && (
        <div className="overlay">
          <div className="panel">
            <div className="title">KONIEC GRY</div>
            <div className="reason">Zabrakło tlenu.</div>
            <button onClick={()=>location.reload()}>Nowa gra</button>
          </div>
        </div>
      )}
    </div>
  );
}
