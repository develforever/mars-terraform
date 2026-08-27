import { useState, useEffect } from "react";
import { Html } from "@react-three/drei";
import { useTranslation } from "react-i18next";
import type { PlacedBuilding } from "../../../domain/entities/Building";
import { BUILDING_DEFINITIONS } from "../../../domain/config/buildings";
import { BuildingService } from "../../../domain/services/BuildingService";
import { WeatherService } from "../../../domain/services/WeatherService";
import { NeighborService } from "../../../domain/services/NeighborService";
import { useGameStore } from "../../../application/store/useGameStore";
import { useUIStore } from "../../../application/store/useUIStore";

export interface BuildingInspectionPopoverProps {
  building: PlacedBuilding;
}

export function BuildingInspectionPopover({ building }: BuildingInspectionPopoverProps) {
  const def = BUILDING_DEFINITIONS[building.definitionId];
  const { t } = useTranslation();
  const placed = useGameStore((state) => state.placed);
  const resources = useGameStore((state) => state.resources);
  const sunFactor = useGameStore((state) => state.sun);
  const weather = useGameStore((state) => state.weather);
  const resourceNodes = useGameStore((state) => state.resourceNodes);
  const upgradeBuilding = useGameStore((state) => state.upgradeBuilding);
  const toggleBuildingPower = useGameStore((state) => state.toggleBuildingPower);
  const demolishBuilding = useGameStore((state) => state.demolishBuilding);
  const setInspectedInstance = useUIStore((state) => state.setInspectedInstance);

  const [confirmDemolish, setConfirmDemolish] = useState(false);

  const currentLevel = building.level ?? 1;
  const isPowered = !building.disabled;
  const productionModifier = WeatherService.getProductionModifier(weather);
  const condFactor = BuildingService.conditionFactor(building.condition);
  const neighborMult = def ? NeighborService.getProductionMultiplier(building, def, placed, BUILDING_DEFINITIONS) : 1;
  const depositMult = def ? BuildingService.getDepositMultiplier(building, def, resourceNodes) : 1;
  const levelMult = def ? BuildingService.getLevelMultiplier(building, def) : 1;
  const extractionRadius = def ? BuildingService.getExtractionRadius(building, def) : 1;
  const depositEfficiency = def
    ? BuildingService.getDepositEfficiencyAtCell(def, { x: building.position.x, z: building.position.z }, resourceNodes, extractionRadius)
    : undefined;

  const nextUpgrade = def ? BuildingService.getNextUpgrade(building, def) : undefined;
  const canAffordUpgrade = nextUpgrade ? BuildingService.canAfford(nextUpgrade.cost, resources) : false;

  const baseValues = def?.production ? Object.entries(def.production) : [];

  const activeBonuses = def?.bonusNeighbors
    ? def.bonusNeighbors.filter((bn) =>
        placed.some(
          (p) =>
            p.id !== building.id &&
            p.definitionId === bn.neighborId &&
            NeighborService.getNeighbors(building, placed).some((n) => n.definitionId === bn.neighborId)
        )
      )
    : [];

  const hasAnyProduction = baseValues.some(([, baseVal]) => {
    let adjusted = baseVal;
    if (def?.tags?.includes("dayScaled") && baseVal > 0) adjusted *= sunFactor;
    adjusted *= productionModifier;
    return adjusted > 0;
  });

  const showModifiers =
    isPowered &&
    hasAnyProduction &&
    (condFactor < 1 ||
      neighborMult > 1 ||
      depositMult > 1 ||
      levelMult > 1 ||
      def?.tags?.includes("dayScaled") ||
      productionModifier < 1);

  // Keyboard shortcut: Escape dismisses popover
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setInspectedInstance(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setInspectedInstance]);

  const handleDemolish = (e: React.MouseEvent) => {
    e.stopPropagation();
    demolishBuilding({ x: building.position.x, z: building.position.z });
    setInspectedInstance(null);
  };

  const refund = def?.cost ? BuildingService.calculateRefund(def.cost) : {};

  return (
    <Html position={[0, 3, 0]} center style={{ pointerEvents: "none" }}>
      <div
        className="building-popover"
        style={{ pointerEvents: "auto", minWidth: "260px" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="popover-header">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="truncate font-bold text-cyan-400">{def?.name ?? building.definitionId}</h3>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 whitespace-nowrap">
              {t("popover.levelBadge", { level: currentLevel })}
            </span>
          </div>
          <button
            type="button"
            className="popover-close-btn"
            onClick={(e) => {
              e.stopPropagation();
              setInspectedInstance(null);
            }}
            aria-label={t("popover.close", "Zamknij")}
          >
            ✕
          </button>
        </div>

        <div className="popover-content flex flex-col gap-2">
          {/* Integrity progress bar */}
          <div className="popover-stat">
            <div className="stat-label">{t("popover.integrity")}</div>
            <div className="progress-bar-container">
              <div className="progress-bar-bg">
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${building.condition}%`,
                    backgroundColor: building.condition < 30 ? "#ff3355" : "#00ff88",
                  }}
                />
              </div>
              <span className="stat-value font-mono">{Math.round(building.condition)}%</span>
            </div>
          </div>

          {/* Power toggle control */}
          <div className="flex items-center justify-between p-1.5 rounded bg-black/40 border border-white/10 text-xs">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isPowered ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-rose-500 shadow-[0_0_8px_#f43f5e]"}`} />
              <span className="text-zinc-300 font-semibold">
                {isPowered ? t("popover.powerActive", "Aktywne (Online)") : t("popover.powerDisabled", "Wyłączone (Offline)")}
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleBuildingPower(building.id);
              }}
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer border ${
                isPowered
                  ? "bg-amber-950/60 hover:bg-amber-900/80 border-amber-500/40 text-amber-300"
                  : "bg-emerald-950/60 hover:bg-emerald-900/80 border-emerald-500/40 text-emerald-300"
              }`}
            >
              {isPowered ? "Wyłącz" : "Włącz"}
            </button>
          </div>

          {/* Offline notice if disabled */}
          {!isPowered && (
            <div className="p-1.5 rounded bg-rose-950/40 border border-rose-500/30 text-[11px] text-rose-300 flex items-center gap-1.5">
              <span>⚠️</span>
              <span>{t("popover.powerNotice", "Zasilanie wyłączone — wstrzymano produkcję i pobór surowców.")}</span>
            </div>
          )}

          {/* Production Card */}
          {baseValues.length > 0 && isPowered && (
            <div className="popover-section">
              <div className="section-title">{t("popover.production")}</div>
              {baseValues.map(([res, baseVal]) => {
                let adjusted = baseVal;
                if (def?.tags?.includes("dayScaled") && res === "power") {
                  adjusted *= sunFactor;
                }
                adjusted *= productionModifier;
                const isProduction = adjusted > 0;
                if (isProduction) {
                  adjusted *= condFactor * neighborMult * depositMult * levelMult;
                }
                const hasDiff = Math.abs(adjusted - baseVal) >= 0.001;
                return (
                  <div key={res} className="production-item">
                    <span className="res-name">{res}</span>
                    {hasDiff ? (
                      <div className="res-values">
                        <span className="res-base">
                          {baseVal > 0 ? "+" : ""}
                          {baseVal.toFixed(2)}
                        </span>
                        <span className="res-arrow">→</span>
                        <span
                          className={`res-actual ${
                            adjusted > 0 ? "res-actual-pos" : adjusted < 0 ? "res-actual-neg" : ""
                          }`}
                        >
                          {adjusted > 0 ? "+" : ""}
                          {adjusted.toFixed(2)}
                        </span>
                      </div>
                    ) : (
                      <span className="res-val">
                        {adjusted > 0 ? "+" : ""}
                        {adjusted}
                      </span>
                    )}
                  </div>
                );
              })}

              {/* Modifiers tags */}
              {showModifiers && (
                <div className="popover-modifiers">
                  {def?.tags?.includes("dayScaled") && (
                    <span className="mod-tag">☀️ {Math.round(sunFactor * 100)}%</span>
                  )}
                  {condFactor < 1 && (
                    <span className="mod-tag mod-damage">🔧 {Math.round(condFactor * 100)}%</span>
                  )}
                  {neighborMult > 1 && (
                    <span className="mod-tag mod-bonus">🔗 +{Math.round((neighborMult - 1) * 100)}%</span>
                  )}
                  {depositMult > 1 && (
                    <span className="mod-tag mod-deposit">
                      ⛏️ +{Math.round((depositMult - 1) * 100)}% ({t("popover.depositYield")})
                    </span>
                  )}
                  {levelMult > 1 && (
                    <span className="mod-tag mod-bonus">⭐ x{levelMult.toFixed(1)} (POZ. {currentLevel})</span>
                  )}
                  {productionModifier < 1 && (
                    <span className="mod-tag mod-storm">🌪️ {Math.round(productionModifier * 100)}%</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Active Neighbor / Deposit Boost items */}
          {isPowered && (activeBonuses.length > 0 || (depositEfficiency && depositEfficiency.count > 0)) && (
            <div className="popover-section">
              <div className="section-title">{t("popover.neighborBoost")}</div>
              {depositEfficiency && depositEfficiency.count > 0 && (
                <div className="boost-item">
                  <span className="boost-check">💎</span>
                  <span className="boost-desc">
                    {t("popover.depositConnected", {
                      count: depositEfficiency.count,
                      type: depositEfficiency.depositType,
                      bonus: Math.round((depositMult - 1) * 100),
                    })}
                  </span>
                </div>
              )}
              {activeBonuses.map((b) => (
                <div key={b.neighborId} className="boost-item">
                  <span className="boost-check">✓</span>
                  <span className="boost-desc">{b.description}</span>
                </div>
              ))}
            </div>
          )}

          {/* Upgrades Section */}
          <div className="popover-section mt-1 pt-2 border-t border-white/10">
            <div className="section-title flex justify-between items-center text-[10px] uppercase text-zinc-400 font-bold mb-1.5">
              <span>{t("popover.upgrades")}</span>
              <span className="text-zinc-500 font-mono">{currentLevel}/3</span>
            </div>

            {currentLevel >= 3 || !nextUpgrade ? (
              <div className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
                <span>⭐</span>
                <span>{t("popover.maxLevel", { level: currentLevel })}</span>
              </div>
            ) : (
              <div className="bg-black/30 border border-white/10 rounded-lg p-2 flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-zinc-200">
                    {t("popover.upgradeTo", { level: nextUpgrade.level })}
                  </span>
                  <span className="font-mono text-cyan-400 font-bold">
                    x{nextUpgrade.productionMultiplier.toFixed(1)}
                  </span>
                </div>

                {nextUpgrade.extractionRadius && (
                  <div className="text-[11px] text-zinc-300 flex items-center gap-1">
                    <span className="text-cyan-400">📏</span>
                    <span>{t("popover.extractionRadius", { radius: nextUpgrade.extractionRadius })}</span>
                  </div>
                )}

                {nextUpgrade.unlockedUnit && (
                  <div className="text-[11px] text-emerald-300 flex items-center gap-1">
                    <span>{nextUpgrade.unlockedUnit === "rover" ? "🚙" : "🛸"}</span>
                    <span>
                      {t("popover.unlockedUnit", {
                        unit:
                          nextUpgrade.unlockedUnit === "rover"
                            ? t("popover.units.rover")
                            : t("popover.units.drone"),
                      })}
                    </span>
                  </div>
                )}

                {/* Cost preview */}
                <div className="mt-1 flex flex-wrap gap-1 items-center">
                  <span className="text-[10px] text-zinc-400 mr-1">{t("popover.upgradeCost")}</span>
                  {Object.entries(nextUpgrade.cost).map(([res, costVal]) => {
                    if (costVal === undefined) return null;
                    const resKey = res as keyof typeof resources;
                    const hasEnough = resources[resKey] >= costVal;
                    return (
                      <span
                        key={res}
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold border ${
                          hasEnough
                            ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
                            : "bg-rose-950/60 border-rose-500/40 text-rose-300"
                        }`}
                      >
                        {res}: {costVal}
                      </span>
                    );
                  })}
                </div>

                {/* Upgrade button */}
                <button
                  type="button"
                  disabled={!canAffordUpgrade}
                  onClick={(e) => {
                    e.stopPropagation();
                    upgradeBuilding(building.id);
                  }}
                  className={`mt-1 w-full py-1.5 px-3 rounded text-xs font-bold uppercase tracking-wider transition-all duration-200 pointer-events-auto ${
                    canAffordUpgrade
                      ? "bg-cyan-600 hover:bg-cyan-500 active:scale-98 text-white shadow-md shadow-cyan-600/30 cursor-pointer"
                      : "bg-zinc-800 text-zinc-500 border border-zinc-700/40 cursor-not-allowed"
                  }`}
                >
                  {t("popover.upgrade")}
                </button>
              </div>
            )}
          </div>

          {/* Demolish Section with confirmation */}
          <div className="popover-section mt-1 pt-2 border-t border-white/10">
            {!confirmDemolish ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDemolish(true);
                }}
                className="w-full py-1.5 px-2 rounded text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 border border-rose-500/20 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>🗑️</span>
                <span>{t("popover.demolish", "Wyburz budynek")}</span>
              </button>
            ) : (
              <div className="p-2 rounded bg-rose-950/40 border border-rose-500/40 flex flex-col gap-1.5">
                <div className="text-xs font-semibold text-rose-200 text-center">
                  {t("popover.demolishConfirmMsg", "Czy na pewno chcesz wyburzyć ten obiekt?")}
                </div>
                {Object.keys(refund).length > 0 && (
                  <div className="text-[10px] text-zinc-400 text-center">
                    {t("popover.demolishRefund", "Zwrot surowców (50%):")}{" "}
                    {Object.entries(refund)
                      .map(([k, v]) => `${k}: +${v}`)
                      .join(", ")}
                  </div>
                )}
                <div className="flex gap-1.5 mt-1">
                  <button
                    type="button"
                    onClick={handleDemolish}
                    className="flex-1 py-1 px-2 rounded text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer transition-colors"
                  >
                    {t("popover.demolishYes", "Tak, wyburz")}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDemolish(false);
                    }}
                    className="flex-1 py-1 px-2 rounded text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer transition-colors"
                  >
                    {t("popover.demolishCancel", "Anuluj")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Html>
  );
}

export default BuildingInspectionPopover;
