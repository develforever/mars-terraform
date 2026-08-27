import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BUILDING_DEFINITIONS, BUILDING_SEED } from "../../../domain/config/buildings";
import { BuildingService } from "../../../domain/services/BuildingService";
import { NeighborService } from "../../../domain/services/NeighborService";
import { ResearchService } from "../../../domain/services/ResearchService";
import type { BuildingDefinition } from "../../../domain/entities/Building";
import type { PlacedBuilding } from "../../../domain/entities/Building";
import type { ResourceKey, Resources } from "../../../domain/entities/Resources";
import { BuildingTooltip } from "./BuildingTooltip";
import { useGameStore } from "../../../application/store/useGameStore";

interface BuildingIconProps {
    id: string;
    name: string;
    color?: string;
}

const BuildingIcon = ({ id, name, color }: BuildingIconProps) => {
    const [hasError, setHasError] = useState(false);

    if (hasError) {
        return (
            <span
                className="inline-block w-3.5 h-3.5 rounded-full shrink-0"
                style={{ backgroundColor: color }}
                title={name}
            />
        );
    }

    return (
        <img
            src={`/icons/buildings/${id}.webp`}
            alt={name}
            className="palette-btn__icon"
            onError={() => setHasError(true)}
            loading="lazy"
        />
    );
};

const RESOURCE_LABELS: Record<ResourceKey, string> = {
    o2:      "O₂",
    power:   "⚡",
    water:   "💧",
    biomass: "🧪",
};

interface BuildingPaletteProps {
    resources: Resources;
    placedBuildings: PlacedBuilding[];
    selectedBuildingId: string | null;
    demolishActive: boolean;
    onSelect: (defId: string) => void;
    onOpenResearch?: (techId?: string) => void;
    onOpenDependencies?: () => void;
    onResourceShortage?: (missingResources: ResourceKey[]) => void;
}

export function BuildingPalette({
    resources,
    placedBuildings,
    selectedBuildingId,
    demolishActive,
    onSelect,
    onOpenResearch,
    onOpenDependencies,
    onResourceShortage,
}: BuildingPaletteProps) {
    const { t } = useTranslation();

    const CATEGORY_LABELS: Record<string, string> = {
        living:         t("hud.category.living"),
        production:     t("hud.category.production"),
        storage:        t("hud.category.storage"),
        infrastructure: t("hud.category.infrastructure"),
        defense:        t("hud.category.defense"),
    };

    const buildingsByCategory = useMemo(() => {
        const groups: Record<string, BuildingDefinition[]> = {};
        BUILDING_SEED.forEach((b) => {
            if (!groups[b.category]) groups[b.category] = [];
            groups[b.category].push(b);
        });
        return groups;
    }, []);

    const activeBonuses = useMemo(
        () => NeighborService.getAllActiveBonuses(placedBuildings, BUILDING_DEFINITIONS),
        [placedBuildings],
    );

    const unlockedTechs = useGameStore((state) => state.unlockedTechs);

    const canAfford = (defId: string) => {
        const def = BUILDING_DEFINITIONS[defId];
        return def ? BuildingService.canAfford(def.cost, resources) : false;
    };

    const checkRequirements = (def: BuildingDefinition) =>
        BuildingService.hasRequirements(def, placedBuildings);

    const isTechUnlocked = (def: BuildingDefinition): boolean =>
        ResearchService.isBuildingUnlocked(def.id, BUILDING_DEFINITIONS, unlockedTechs);

    const placedIds = useMemo(
        () => new Set(placedBuildings.map((b) => b.definitionId)),
        [placedBuildings]
    );

    return (
        <div className="hud-dock__categories">
            {(Object.entries(buildingsByCategory) as [string, BuildingDefinition[]][]).map(([cat, items]) => (
                <div key={cat} className="hud-dock__category-group">
                    <div className="category-label">{CATEGORY_LABELS[cat] || cat}</div>
                    <div className="hud-dock__row hud-dock__row--palette">
                        {items.map((def: BuildingDefinition) => {
                            const active    = selectedBuildingId === def.id;
                            const affordable = canAfford(def.id);
                            const reqsMet   = checkRequirements(def);
                            const techOk    = isTechUnlocked(def);
                            const isPlaced  = placedIds.has(def.id);
                            const costEntries = (Object.entries(def.cost) as [ResourceKey, number][])
                                .filter(([, v]) => v !== undefined && v > 0);
                            const prodEntries = (Object.entries(def.production || {}) as [ResourceKey, number][])
                                .filter(([, v]) => v !== undefined && v !== 0);
                            const capEntries = (Object.entries(def.capacity || {}) as [ResourceKey, number][])
                                .filter(([, v]) => v !== undefined && v > 0);

                            const tooltipContent = (
                                <>
                                    <div className="tooltip-title">{def.name}</div>
                                    {!techOk && (
                                        <div className="tooltip-section requirements-section">
                                            <div className="tooltip-subtitle">🔬 {t("research.prereqs")}</div>
                                            <div className="deficit">
                                                {t("research.status.locked")}: {t("research.prereqs")} «{def.requiredTech}»
                                            </div>
                                        </div>
                                    )}
                                    {!reqsMet && techOk && (
                                        <div className="tooltip-section requirements-section">
                                            <div className="tooltip-subtitle">{t("hud.requirements")}</div>
                                            <div className="deficit">
                                                {t("hud.requires")}: {def.dependsOn?.map((id: string) => BUILDING_DEFINITIONS[id]?.name || id).join(", ")}
                                            </div>
                                        </div>
                                    )}
                                    {costEntries.length > 0 && (
                                        <table className="tooltip-table">
                                            <thead>
                                                <tr>
                                                    <th>{t("hud.resource")}</th>
                                                    <th>{t("hud.cost")}</th>
                                                    <th>{t("hud.youHave")}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {costEntries.map(([key, cost]) => (
                                                    <tr key={key} className={resources[key] < cost ? "deficit" : ""}>
                                                        <td>{RESOURCE_LABELS[key]}</td>
                                                        <td>{cost}</td>
                                                        <td>{resources[key].toFixed(1)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                    {prodEntries.length > 0 && (
                                        <div className="tooltip-section">
                                            <div className="tooltip-subtitle">{t("hud.production")}</div>
                                            {prodEntries.map(([key, val]) => (
                                                <div key={key} className={val > 0 ? "prod-positive" : "prod-negative"}>
                                                    {RESOURCE_LABELS[key]} {val > 0 ? "+" : ""}{val}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {def.bonusNeighbors && def.bonusNeighbors.length > 0 && (
                                        <div className="tooltip-section">
                                            <div className="tooltip-subtitle">{t("hud.neighborBonus")}</div>
                                            {def.bonusNeighbors.map((b) => {
                                                const isActive = activeBonuses.some(
                                                    (ab) => ab.buildingId === placedBuildings.find(p => p.definitionId === def.id)?.id && ab.neighborId === b.neighborId
                                                );
                                                return (
                                                    <div key={b.neighborId} className={isActive ? "prod-positive" : ""} style={{ opacity: isActive ? 1 : 0.5 }}>
                                                        {isActive ? "✓" : "○"} {b.description}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {def.extractsDeposit && (
                                        <div className="tooltip-section">
                                            <div className="tooltip-subtitle">{t("hud.depositBonusTitle", "💎 Złoża surowców")}</div>
                                            <div className="prod-positive" style={{ fontSize: "11px" }}>
                                                ⛏️ +50% {t("hud.yieldPerDeposit", "wydajności za każde sąsiednie złoże:")} {def.extractsDeposit}
                                            </div>
                                        </div>
                                    )}
                                    {capEntries.length > 0 && (
                                        <div className="tooltip-section">
                                            <div className="tooltip-subtitle">{t("hud.capacity")}</div>
                                            {capEntries.map(([key, val]) => (
                                                <div key={key}>{RESOURCE_LABELS[key]} +{val}</div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            );

                            const handleButtonClick = () => {
                                if (demolishActive) return;
                                if (!techOk) {
                                    onOpenResearch?.(def.requiredTech);
                                    return;
                                }
                                if (!reqsMet) {
                                    onOpenDependencies?.();
                                    return;
                                }
                                if (!affordable) {
                                    const missing = (Object.entries(def.cost) as [ResourceKey, number][])
                                        .filter(([k, cost]) => (resources[k] ?? 0) < cost)
                                        .map(([k]) => k);
                                    onResourceShortage?.(missing);
                                    return;
                                }
                                onSelect(def.id);
                            };

                            const buttonClasses = [
                                "palette-btn",
                                active ? "active" : "",
                                !reqsMet || !techOk ? "locked" : "",
                                !techOk ? "tech-locked" : "",
                                !affordable ? "unaffordable" : "",
                                isPlaced ? "placed" : "",
                            ].filter(Boolean).join(" ");

                            return (
                                <BuildingTooltip key={def.id} content={tooltipContent}>
                                    <button
                                        type="button"
                                        className={buttonClasses}
                                        onClick={handleButtonClick}
                                    >
                                        <BuildingIcon id={def.id} name={def.name} color={def.color} />
                                        {isPlaced && <span style={{ color: "#4ade80", marginRight: 2 }}>●</span>}
                                        <span>{def.name}</span>
                                        {!techOk ? " 🔬" : !affordable && reqsMet ? ` · ${t("hud.shortage")}` : ""}
                                        {techOk && !reqsMet ? " 🔒" : ""}
                                    </button>
                                </BuildingTooltip>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}
