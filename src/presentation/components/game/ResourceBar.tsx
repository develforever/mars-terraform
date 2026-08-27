import type { ResourceKey, Resources, ResourceDelta, ResourceCapacity } from "../../../domain/entities/Resources";
import type { ColonyPopulation, MoraleState } from "../../../domain/entities/Colonist";
import { TimeControls } from "./TimeControls";

interface ResourceBarProps {
    sun: number;
    resources: Resources;
    capacity: ResourceCapacity;
    terraforming: number;
    lastDelta: ResourceDelta;
    colonyName: string;
    activePanel: ResourceKey | "terraforming" | null;
    onTogglePanel: (key: ResourceKey | "terraforming") => void;
    population?: ColonyPopulation;
    morale?: MoraleState;
    onOpenColonists?: () => void;
    flashingResources?: ResourceKey[];
}

function renderDelta(val: number | undefined) {
    if (!val || val === 0) return null;
    if (val > 0) return <span className="delta-positive">▲{val.toFixed(1)}</span>;
    return <span className="delta-negative">▼{Math.abs(val).toFixed(1)}</span>;
}

export function ResourceBar({
    sun,
    resources,
    capacity,
    terraforming,
    lastDelta,
    colonyName,
    activePanel,
    onTogglePanel,
    population,
    morale,
    onOpenColonists,
    flashingResources = [],
}: ResourceBarProps) {
    const isFlashing = (key: ResourceKey) => flashingResources.includes(key);

    const btn = (key: ResourceKey | "terraforming") => {
        const activeClass = activePanel === key ? " bar-btn--active" : "";
        const flashClass = typeof key !== "string" || key === "terraforming" ? "" : isFlashing(key as ResourceKey) ? " bar-btn--shortage-flash" : "";
        return `bar-btn${activeClass}${flashClass}`;
    };

    const getMoraleEmoji = (val: number) => {
        if (val >= 75) return "😊";
        if (val < 30) return "😞";
        return "😐";
    };

    return (
        <div className="bar">
            <span>☀️ {sun.toFixed(2)}</span>
            <button className={btn("o2")} onClick={() => onTogglePanel("o2")}>
                💨 O₂ {resources.o2.toFixed(1)} {renderDelta(lastDelta?.o2)}
            </button>
            <button className={btn("power")} onClick={() => onTogglePanel("power")}>
                ⚡ {resources.power.toFixed(1)} / {capacity.power} {renderDelta(lastDelta?.power)}
            </button>
            <button className={btn("water")} onClick={() => onTogglePanel("water")}>
                💧 {resources.water.toFixed(1)} / {capacity.water} {renderDelta(lastDelta?.water)}
            </button>
            <button className={btn("biomass")} onClick={() => onTogglePanel("biomass")}>
                🧪 {resources.biomass.toFixed(1)} / {capacity.biomass} {renderDelta(lastDelta?.biomass)}
            </button>
            <button className={`${btn("terraforming")} terraforming-bar`} onClick={() => onTogglePanel("terraforming")}>
                🌍 {terraforming.toFixed(1)}%
                <span className="terraforming-track">
                    <span className="terraforming-fill" style={{ width: `${terraforming}%` }} />
                </span>
            </button>
            {population && (
                <button
                    className="bar-btn bar-btn--population"
                    onClick={onOpenColonists}
                    title="Zarządzanie Populacją i Załogą (C)"
                >
                    👥 {population.total} / {population.capacity}
                </button>
            )}
            {morale && (
                <button
                    className={`bar-btn bar-btn--morale ${
                        morale.value >= 75 ? "bar-btn--morale-high" : morale.value < 30 ? "bar-btn--morale-low" : "bar-btn--morale-med"
                    }`}
                    onClick={onOpenColonists}
                    title={`Morale Kolonii: ${morale.value}% (Mnożnik: x${morale.productivityMultiplier.toFixed(2)})`}
                >
                    {getMoraleEmoji(morale.value)} {morale.value}%
                </button>
            )}
            <TimeControls />
            {colonyName && <span className="bar-colony-name">🏛 {colonyName}</span>}
        </div>
    );
}
