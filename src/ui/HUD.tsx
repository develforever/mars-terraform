import { useEffect } from "react";
import { useMars } from "../app/mars3d/store";
import "./HUD.scss";

export function HUD() {
  const { o2, power, water, biomass, cap, buildDefId, setBuildDef, canAfford, sun, alive,
    buildMode, toggleBuildPlace, toggleDemolish, cancelBuild } = useMars();

  // skróty klawiaturowe
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'b' || e.key === 'B') toggleBuildPlace();
      if (e.key === 'x' || e.key === 'X') toggleDemolish();
      if (e.key === 'Escape') cancelBuild();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleBuildPlace, toggleDemolish, cancelBuild]);

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

  const placeActive = buildMode === 'place';
  const demolishActive = buildMode === 'demolish';

  return (
    <div className="hud">
      <div className="bar">
        <span>☀️ {sun.toFixed(2)}</span>
        <span>💨 O₂ {o2.toFixed(1)}</span>
        <span>⚡ {power.toFixed(1)} / {cap.power}</span>
        <span>💧 {water.toFixed(1)} / {cap.water}</span>
        <span>🧪 {biomass.toFixed(1)} / {cap.biomass}</span>
      </div>

      <div className="build build-actions">
        <button className={placeActive ? "active" : ""} onClick={toggleBuildPlace}>🛠️ Buduj (B)</button>
        <button className={demolishActive ? "active" : ""} onClick={toggleDemolish}>🗑️ Rozbiórka (X)</button>
        <button onClick={cancelBuild}>✖ Anuluj (Esc)</button>
      </div>

      <div className="build build-items">
        {buttons.map(b => {
          const active = buildDefId === b.id;
          const ok = canAfford(b.id);
          return (
            <button
              key={b.id}
              className={active ? "active" : ""}
              disabled={!ok || demolishActive} // w trybie demolki wybór budynku nie ma sensu
              onClick={() => setBuildDef(b.id)}
              title="Wybór typu budynku (użyj 'Buduj (B)' żeby wejść w tryb stawiania)"
            >
              {b.label}{ok ? "" : " (braki)"}
            </button>
          );
        })}
      </div>

      {!alive && (
        <div className="overlay">
          <div className="panel">
            <div className="title">KONIEC GRY</div>
            <div className="reason">Zabrakło tlenu.</div>
            <button onClick={() => location.reload()}>Nowa gra</button>
          </div>
        </div>
      )}
    </div>
  );
}
