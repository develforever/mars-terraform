import type { ResourceKey, Resources, ResourceDelta, ResourceCapacity } from "../../../domain/entities/Resources";

interface ResourceBarProps {
    sun: number;
    resources: Resources;
    capacity: ResourceCapacity;
    terraforming: number;
    lastDelta: ResourceDelta;
    colonyName: string;
    activePanel: ResourceKey | "terraforming" | null;
    onTogglePanel: (key: ResourceKey | "terraforming") => void;
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
}: ResourceBarProps) {
    const btn = (key: ResourceKey | "terraforming") =>
        `bar-btn${activePanel === key ? " bar-btn--active" : ""}`;

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
            {colonyName && <span className="bar-colony-name">🏛 {colonyName}</span>}
        </div>
    );
}
