import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useUIStore } from "../../../application/store/useUIStore";
import { useGameStore } from "../../../application/store/useGameStore";
import { UNIT_DEFINITIONS } from "../../../domain/config/units";
import type { PlacedUnit } from "../../../domain/entities/Unit";

export function UnitCommandCard() {
  const { t } = useTranslation();
  const selectedUnitIds = useUIStore((state) => state.selectedUnitIds);
  const clearUnitSelection = useUIStore((state) => state.clearUnitSelection);
  const selectUnits = useUIStore((state) => state.selectUnits);
  const toggleSelectUnit = useUIStore((state) => state.toggleSelectUnit);
  const units = useGameStore((state) => state.units);
  const issueOrderToUnits = useGameStore((state) => state.issueOrderToUnits);

  const selectedUnits: PlacedUnit[] = useMemo(() => {
    return selectedUnitIds
      .map((id) => units.find((u) => u.id === id))
      .filter((u): u is PlacedUnit => u !== undefined);
  }, [selectedUnitIds, units]);

  if (selectedUnits.length === 0) return null;

  const isMulti = selectedUnits.length > 1;
  const primaryUnit = selectedUnits[0];
  const primaryDef = primaryUnit ? UNIT_DEFINITIONS[primaryUnit.definitionId] : null;

  const handleStop = () => {
    issueOrderToUnits(selectedUnitIds, { type: "STOP" });
  };

  const handleAttack = () => {
    // Attack mode or stop & aggro
    issueOrderToUnits(selectedUnitIds, { type: "STOP" });
  };

  const handleRepair = () => {
    // Repair order
    const damagedBuilding = useGameStore.getState().placed.find((b) => b.condition < 100);
    if (damagedBuilding) {
      issueOrderToUnits(selectedUnitIds, {
        type: "REPAIR",
        targetEntityId: damagedBuilding.id,
      });
    }
  };

  return (
    <div
      data-testid="unit-command-card"
      className="fixed left-4 bottom-20 z-30 w-80 bg-[#0d1117]/95 backdrop-blur-md border border-cyan-500/40 rounded-xl p-3.5 shadow-2xl text-white select-none transition-all duration-200"
      style={{
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.6), 0 0 16px rgba(0, 229, 255, 0.15)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2 mb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-cyan-400 text-sm font-bold tracking-wide uppercase">
            {isMulti
              ? `${t("units.selectedUnits")} (${selectedUnits.length})`
              : primaryDef?.name ?? t("units.singleUnit")}
          </span>
        </div>
        <button
          type="button"
          onClick={clearUnitSelection}
          aria-label="Close"
          className="text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded px-1.5 py-0.5 text-xs font-mono transition-colors cursor-pointer"
          title={t("summary.actions.close")}
        >
          ✕
        </button>
      </div>

      {/* Single Unit Details */}
      {!isMulti && primaryUnit && primaryDef && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {/* Unit Icon Avatar */}
            <div className="w-12 h-12 rounded-lg bg-black/50 border border-cyan-500/30 p-1 flex items-center justify-center overflow-hidden shrink-0">
              <img
                src={primaryDef.iconPath}
                alt={primaryDef.name}
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            </div>

            {/* Meta Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor:
                      primaryDef.role === "combat"
                        ? "rgba(239, 68, 68, 0.2)"
                        : primaryDef.role === "repair"
                        ? "rgba(0, 229, 255, 0.2)"
                        : "rgba(245, 158, 11, 0.2)",
                    color:
                      primaryDef.role === "combat"
                        ? "#f87171"
                        : primaryDef.role === "repair"
                        ? "#38bdf8"
                        : "#fbbf24",
                  }}
                >
                  {t(`units.roles.${primaryDef.role}`)}
                </span>
                <span className="text-gray-400 text-xs truncate">
                  {t(`units.status.${primaryUnit.status}`)}
                </span>
              </div>

              {/* Health Bar */}
              <div className="mt-1.5">
                <div className="flex justify-between text-[11px] font-mono text-gray-300 mb-0.5">
                  <span>HP</span>
                  <span>
                    {Math.round(primaryUnit.currentHealth)} / {primaryDef.stats.maxHealth}
                  </span>
                </div>
                <div className="w-full h-2 bg-black/60 rounded border border-gray-700 overflow-hidden">
                  <div
                    className="h-full transition-all duration-200"
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(100, (primaryUnit.currentHealth / primaryDef.stats.maxHealth) * 100)
                      )}%`,
                      backgroundColor:
                        primaryUnit.currentHealth / primaryDef.stats.maxHealth > 0.5
                          ? "#22c55e"
                          : primaryUnit.currentHealth / primaryDef.stats.maxHealth > 0.25
                          ? "#eab308"
                          : "#ef4444",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Stats Badges */}
          <div className="grid grid-cols-2 gap-1.5 text-[11px] bg-black/30 p-2 rounded border border-white/5 font-mono">
            <div>
              <span className="text-gray-400">{t("units.speed")}: </span>
              <span className="text-cyan-300">{primaryDef.stats.speed} m/s</span>
            </div>
            {primaryDef.stats.attackDamage && (
              <div>
                <span className="text-gray-400">{t("units.attackDamage")}: </span>
                <span className="text-red-400">{primaryDef.stats.attackDamage} DMG</span>
              </div>
            )}
            {primaryDef.stats.repairRate && (
              <div>
                <span className="text-gray-400">{t("units.repairRate")}: </span>
                <span className="text-teal-300">+{primaryDef.stats.repairRate} HP/s</span>
              </div>
            )}
            {primaryDef.stats.cargoCapacity && (
              <div>
                <span className="text-gray-400">Cargo: </span>
                <span className="text-amber-300">{primaryDef.stats.cargoCapacity} kg</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Multi Unit Selection View */}
      {isMulti && (
        <div className="space-y-2 mb-3">
          <div className="grid grid-cols-4 gap-1.5 max-h-28 overflow-y-auto pr-1">
            {selectedUnits.map((u) => {
              const def = UNIT_DEFINITIONS[u.definitionId];
              if (!def) return null;
              const hpPct = Math.round((u.currentHealth / def.stats.maxHealth) * 100);

              return (
                <div
                  key={u.id}
                  onClick={(e) => {
                    if (e.shiftKey) {
                      toggleSelectUnit(u.id);
                    } else {
                      selectUnits([u.id]);
                    }
                  }}
                  className="group relative bg-black/40 hover:bg-cyan-950/40 border border-white/10 hover:border-cyan-400/60 rounded p-1 cursor-pointer transition-all flex flex-col items-center"
                  title={`${def.name} (${hpPct}% HP)`}
                >
                  <img src={def.iconPath} alt={def.name} className="w-7 h-7 object-contain" />
                  <div className="w-full h-1 bg-black/80 rounded-full mt-1 overflow-hidden">
                    <div
                      className="h-full"
                      style={{
                        width: `${hpPct}%`,
                        backgroundColor: hpPct > 50 ? "#22c55e" : hpPct > 25 ? "#eab308" : "#ef4444",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Command Action Buttons */}
      <div className="grid grid-cols-3 gap-1.5 mt-3 pt-2 border-t border-cyan-500/20">
        <button
          type="button"
          onClick={handleStop}
          className="flex flex-col items-center justify-center py-1.5 px-2 bg-gray-800/80 hover:bg-gray-700 active:bg-gray-600 border border-gray-600 rounded text-xs font-semibold text-gray-200 transition-colors cursor-pointer"
          title={`${t("units.orders.stop")} (${t("units.orders.stopKey")})`}
        >
          <span>🛑 {t("units.orders.stop")}</span>
          <span className="text-[10px] text-gray-400 font-mono">({t("units.orders.stopKey")})</span>
        </button>

        <button
          type="button"
          onClick={handleAttack}
          className="flex flex-col items-center justify-center py-1.5 px-2 bg-red-950/40 hover:bg-red-900/60 active:bg-red-800/80 border border-red-500/40 rounded text-xs font-semibold text-red-200 transition-colors cursor-pointer"
          title={`${t("units.orders.attack")} (${t("units.orders.attackKey")})`}
        >
          <span>⚔️ {t("units.orders.attack")}</span>
          <span className="text-[10px] text-red-400 font-mono">({t("units.orders.attackKey")})</span>
        </button>

        <button
          type="button"
          onClick={handleRepair}
          className="flex flex-col items-center justify-center py-1.5 px-2 bg-cyan-950/40 hover:bg-cyan-900/60 active:bg-cyan-800/80 border border-cyan-500/40 rounded text-xs font-semibold text-cyan-200 transition-colors cursor-pointer"
          title={`${t("units.orders.repair")} (${t("units.orders.repairKey")})`}
        >
          <span>🔧 {t("units.orders.repair")}</span>
          <span className="text-[10px] text-cyan-400 font-mono">({t("units.orders.repairKey")})</span>
        </button>
      </div>

      {/* Control Group Hint */}
      <div className="mt-2 text-[9px] text-gray-400 text-center font-mono tracking-tight">
        {t("units.controlGroupHint")}
      </div>
    </div>
  );
}
