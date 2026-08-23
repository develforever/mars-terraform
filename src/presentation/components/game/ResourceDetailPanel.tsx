import { useTranslation } from "react-i18next";
import type { ResourceKey } from "../../../domain/entities/Resources";
import type { PlacedBuilding, BuildingDefinition } from "../../../domain/entities/Building";
import type { ResourceDelta } from "../../../domain/entities/Resources";
import type { DifficultyLevel } from "../../../domain/services/TerraformingService";
import { DIFFICULTY_TARGETS, TerraformingService } from "../../../domain/services/TerraformingService";
import { ResourceBreakdownService } from "../../../domain/services/ResourceBreakdownService";
import { BuildingService } from "../../../domain/services/BuildingService";
import type { ResourceNode } from "../../../domain/mapEditorTypes";
import "./ResourceDetailPanel.css";


const CAPACITY_KEYS: Partial<Record<ResourceKey, boolean>> = {
    power: true,
    water: true,
    biomass: true,
};

interface ResourceDetailPanelProps {
    activePanel: ResourceKey | "terraforming";
    placed: PlacedBuilding[];
    definitions: Record<string, BuildingDefinition>;
    sunFactor: number;
    productionModifier: number;
    resources: { o2: number; power: number; water: number; biomass: number };
    capacity: { power: number; water: number; biomass: number };
    terraforming: number;
    o2Accumulated: number;
    difficulty: DifficultyLevel;
    lastDelta?: ResourceDelta;
    resourceNodes?: ResourceNode[];
    onClose: () => void;
}

export function ResourceDetailPanel({
    activePanel,
    placed,
    definitions,
    sunFactor,
    productionModifier,
    resources,
    capacity,
    terraforming,
    o2Accumulated,
    difficulty,
    lastDelta,
    resourceNodes = [],
    onClose,
}: ResourceDetailPanelProps) {
    const { t } = useTranslation();
    const RESOURCE_LABELS: Record<ResourceKey, string> = {
        o2:      t("hud.resource_labels.o2"),
        power:   t("hud.resource_labels.power"),
        water:   t("hud.resource_labels.water"),
        biomass: t("hud.resource_labels.biomass"),
    };
    if (activePanel === "terraforming") {
        return <TerraformingPanel
            terraforming={terraforming}
            o2Accumulated={o2Accumulated}
            difficulty={difficulty}
            resources={resources}
            lastDelta={lastDelta}
            onClose={onClose}
        />;
    }

    const resource = activePanel as ResourceKey;
    const breakdown = ResourceBreakdownService.getBreakdown(
        resource, placed, definitions, sunFactor, productionModifier, resourceNodes
    );

    const hasCapacity = CAPACITY_KEYS[resource];
    const currentVal = resources[resource] as number;
    const capVal = hasCapacity ? capacity[resource as keyof typeof capacity] : undefined;
    const capPct = capVal ? Math.min(100, (currentVal / capVal) * 100) : 0;

    const valClass = (v: number) =>
        v > 0 ? "rdp__val-pos" : v < 0 ? "rdp__val-neg" : "rdp__val-zero";

    return (
        <div className="rdp">
            <div className="rdp__header">
                <span className="rdp__title">{RESOURCE_LABELS[resource]}</span>
                <button className="rdp__close" onClick={onClose}>✕</button>
            </div>
            <div className="rdp__body">
                {/* Capacity bar */}
                {hasCapacity && capVal !== undefined && (
                    <div>
                        <div className="rdp__capacity-bar">
                            <div
                                className="rdp__capacity-fill"
                                style={{
                                    width: `${capPct}%`,
                                    background: capPct > 90 ? "#f87171" : capPct > 60 ? "#facc15" : "#4ade80",
                                }}
                            />
                        </div>
                        <div className="rdp__capacity-label">
                            <span>{t("rdp.current")}: {currentVal.toFixed(1)}</span>
                            <span>{t("rdp.max")}: {capVal}</span>
                        </div>
                    </div>
                )}

                {/* Producers */}
                <div>
                    <div className="rdp__section-label">{t("rdp.producers")}</div>
                    {breakdown.producers.length === 0
                        ? <div className="rdp__empty">{t("rdp.noProducers")}</div>
                        : breakdown.producers.map((p) => {
                            const b = placed.find((pl) => pl.id === p.buildingId);
                            const d = b ? definitions[b.definitionId] : undefined;
                            const eff = d && b ? BuildingService.getDepositEfficiencyAtCell(d, { x: b.position.x, z: b.position.z }, resourceNodes) : undefined;
                            const hasDepositBonus = eff && eff.count > 0;

                            return (
                                <div key={p.buildingId} className="rdp__row">
                                    <span className="rdp__row-label">{p.label.startsWith("hint.") ? t(p.label) : p.label}</span>
                                    {hasDepositBonus && (
                                        <span className="rdp__row-cond" style={{ color: "#38bdf8", borderColor: "rgba(56,189,248,0.3)", background: "rgba(56,189,248,0.1)" }}>
                                            +{Math.round((eff.multiplier - 1) * 100)}% ⛏️
                                        </span>
                                    )}
                                    {p.condition < 100 && (
                                        <span className="rdp__row-cond">{p.condition}%</span>
                                    )}
                                    <span className={`rdp__row-val ${valClass(p.value)}`}>
                                        {p.value > 0 ? "+" : ""}{p.value.toFixed(2)}
                                    </span>
                                </div>
                            );
                        })
                    }
                </div>

                {/* Consumers */}
                <div>
                    <div className="rdp__section-label">{t("rdp.consumers")}</div>
                    {breakdown.consumers.length === 0
                        ? <div className="rdp__empty">{t("rdp.noConsumers")}</div>
                        : breakdown.consumers.map((c) => (
                            <div key={c.buildingId} className="rdp__row">
                                <span className="rdp__row-label">{c.label.startsWith("hint.") ? t(c.label) : c.label}</span>
                                {c.condition < 100 && c.buildingId !== "__colony" && (
                                    <span className="rdp__row-cond">{c.condition}%</span>
                                )}
                                <span className={`rdp__row-val rdp__val-neg`}>{c.value.toFixed(2)}</span>
                            </div>
                        ))
                    }
                </div>

                {/* Net */}
                <div className="rdp__net">
                    <span style={{ color: "#6b7280" }}>{t("rdp.balance")}</span>
                    <span className={valClass(breakdown.net)}>
                        {breakdown.net > 0 ? "+" : ""}{breakdown.net.toFixed(2)}
                    </span>
                </div>
            </div>
        </div>
    );
}

interface TerraformingPanelProps {
    terraforming: number;
    o2Accumulated: number;
    difficulty: DifficultyLevel;
    resources: { o2: number; power: number; water: number; biomass: number };
    lastDelta?: ResourceDelta;
    onClose: () => void;
}

function TerraformingPanel({ terraforming, o2Accumulated, difficulty, resources, lastDelta, onClose }: TerraformingPanelProps) {
    const { t } = useTranslation();
    const targets = DIFFICULTY_TARGETS[difficulty];

    const o2Pct = Math.min(100, (o2Accumulated / targets.o2Accumulated) * 100);
    const biomassPct = Math.min(100, (resources.biomass / targets.biomass) * 100);
    const waterPct = Math.min(100, (resources.water / targets.water) * 100);

    const etaTicks = (() => {
        if (terraforming >= 100) return null;
        const o2DeltaPerTick = lastDelta?.o2 ?? 0;
        if (o2DeltaPerTick <= 0) return null;
        const ticksForO2 = (targets.o2Accumulated - o2Accumulated) / o2DeltaPerTick;
        return ticksForO2 > 0 ? Math.ceil(ticksForO2) : null;
    })();

    const waterLevel = TerraformingService.calculateWaterLevel(resources.water, terraforming, difficulty);
    const waterStatusKey =
        waterLevel <= -0.16 ? "dry" :
        waterLevel <= 0.6 ? "craters" :
        waterLevel <= 1.2 ? "lowlands" : "flooding";

    return (
        <div className="rdp">
            <div className="rdp__header">
                <span className="rdp__title">{t("rdp.terraforming.title")}</span>
                <button className="rdp__close" onClick={onClose}>✕</button>
            </div>
            <div className="rdp__body">
                <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                        <span style={{ color: "#e5e7eb", fontWeight: 700 }}>{terraforming.toFixed(1)}%</span>
                        <span style={{ color: "#4b5563", fontSize: "10px" }}>{difficulty.toUpperCase()}</span>
                    </div>
                    <div className="rdp__tf-bar">
                        <div className="rdp__tf-fill" style={{ width: `${terraforming}%` }} />
                    </div>
                </div>

                <div>
                    <div className="rdp__section-label">{t("rdp.terraforming.pillars")}</div>
                    <table className="rdp__tf-table">
                        <thead>
                            <tr>
                                <th>{t("rdp.terraforming.pillar")}</th>
                                <th style={{ textAlign: "right" }}>{t("rdp.terraforming.current")}</th>
                                <th style={{ textAlign: "right" }}>{t("rdp.terraforming.target")}</th>
                                <th style={{ textAlign: "right" }}>{t("rdp.terraforming.pct")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>{t("rdp.terraforming.o2accum")}</td>
                                <td style={{ textAlign: "right", color: "#9ca3af" }}>{o2Accumulated.toFixed(0)}</td>
                                <td style={{ textAlign: "right", color: "#6b7280" }}>{targets.o2Accumulated}</td>
                                <td>{o2Pct.toFixed(0)}%</td>
                            </tr>
                            <tr>
                                <td>{t("rdp.terraforming.biomass")}</td>
                                <td style={{ textAlign: "right", color: "#9ca3af" }}>{resources.biomass.toFixed(1)}</td>
                                <td style={{ textAlign: "right", color: "#6b7280" }}>{targets.biomass}</td>
                                <td>{biomassPct.toFixed(0)}%</td>
                            </tr>
                            <tr>
                                <td>{t("rdp.terraforming.water")}</td>
                                <td style={{ textAlign: "right", color: "#9ca3af" }}>{resources.water.toFixed(1)}</td>
                                <td style={{ textAlign: "right", color: "#6b7280" }}>{targets.water}</td>
                                <td>{waterPct.toFixed(0)}%</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div style={{ marginTop: "8px", padding: "8px", background: "rgba(10, 30, 63, 0.5)", borderRadius: "4px", border: "1px solid rgba(27, 108, 168, 0.4)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
                        <span style={{ color: "#38bdf8", fontWeight: 600 }}>💧 {t("rdp.terraforming.waterLevel")}</span>
                        <span style={{ color: "#93c5fd", fontWeight: 700 }}>{t("rdp.terraforming.waterLevelValue", { level: waterLevel.toFixed(2) })}</span>
                    </div>
                    <div style={{ fontSize: "10px", color: "#94a3b8" }}>
                        {t(`rdp.terraforming.waterStatus.${waterStatusKey}`)}
                    </div>
                </div>

                {etaTicks !== null && (
                    <div className="rdp__eta">
                        {t("rdp.terraforming.eta", { ticks: etaTicks })}
                    </div>
                )}
                {terraforming >= 100 && (
                    <div className="rdp__eta" style={{ color: "#4ade80" }}>
                        {t("rdp.terraforming.done")}
                    </div>
                )}
            </div>
        </div>
    );
}
