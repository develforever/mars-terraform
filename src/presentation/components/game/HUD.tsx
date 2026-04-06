import { useEffect } from "react";
import { useGameStore } from "../../../application/store/useGameStore";
import { useUIStore } from "../../../application/store/useUIStore";
import { BUILDING_DEFINITIONS } from "../../../domain/config/buildings";
import { BuildingService } from "../../../domain/services/BuildingService";
import "./HUD.css";

export function HUD() {
    const resources = useGameStore((state) => state.resources);
    const capacity = useGameStore((state) => state.capacity);
    const sun = useGameStore((state) => state.sun);
    const alive = useGameStore((state) => state.alive);
    const selectedBuildingId = useUIStore((state) => state.selectedBuildingId);
    const setSelectedBuilding = useUIStore((state) => state.setSelectedBuilding);
    const buildMode = useUIStore((state) => state.buildMode);
    const toggleBuildMode = useUIStore((state) => state.toggleBuildMode);
    const toggleDemolishMode = useUIStore((state) => state.toggleDemolishMode);
    const cancelBuild = useUIStore((state) => state.cancelBuild);

    // Keyboard shortcuts
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === "b" || e.key === "B") toggleBuildMode();
            if (e.key === "x" || e.key === "X") toggleDemolishMode();
            if (e.key === "Escape") cancelBuild();
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [toggleBuildMode, toggleDemolishMode, cancelBuild]);

    const buttons = [
        { id: "hab", label: "Kapsuła" },
        { id: "greenhouse", label: "Szklarnia" },
        { id: "solar", label: "Panel" },
        { id: "ice", label: "Kolektor" },
        { id: "battery", label: "Mag. energii" },
        { id: "watertank", label: "Zbiornik" },
        { id: "silo", label: "Silos" },
        { id: "recycler", label: "Recykler" },
        { id: "rtg", label: "RTG" },
    ];

    const placeActive = buildMode === "place";
    const demolishActive = buildMode === "demolish";

    const canAfford = (defId: string): boolean => {
        const def = BUILDING_DEFINITIONS[defId];
        return def ? BuildingService.canAfford(def.cost, resources) : false;
    };

    return (
        <div className="hud">
            <div className="bar">
                <span>☀️ {sun.toFixed(2)}</span>
                <span>💨 O₂ {resources.o2.toFixed(1)}</span>
                <span>⚡ {resources.power.toFixed(1)} / {capacity.power}</span>
                <span>💧 {resources.water.toFixed(1)} / {capacity.water}</span>
                <span>🧪 {resources.biomass.toFixed(1)} / {capacity.biomass}</span>
            </div>

            <div className="build build-actions">
                <button className={placeActive ? "active" : ""} onClick={toggleBuildMode}>🛠️ Buduj (B)</button>
                <button className={demolishActive ? "active" : ""} onClick={toggleDemolishMode}>🗑️ Rozbiórka (X)</button>
                <button onClick={cancelBuild}>✖ Anuluj (Esc)</button>
            </div>

            <div className="build build-items">
                {buttons.map((b) => {
                    const active = selectedBuildingId === b.id;
                    const ok = canAfford(b.id);
                    return (
                        <button
                            key={b.id}
                            className={active ? "active" : ""}
                            disabled={!ok || demolishActive}
                            onClick={() => setSelectedBuilding(b.id)}
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
