import { useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useGameStore } from "../../../application/store/useGameStore";
import type { ColonistRole } from "../../../domain/entities/Colonist";
import { ColonistService } from "../../../domain/services/ColonistService";

interface ColonistManagerModalProps {
  onClose: () => void;
}

interface RoleConfig {
  id: ColonistRole;
  titleKey: string;
  icon: string;
  descriptionKey: string;
  bonusText: (count: number) => string;
}

export function ColonistManagerModal({ onClose }: ColonistManagerModalProps) {
  const { t } = useTranslation();
  const population = useGameStore((s) => s.population);
  const morale = useGameStore((s) => s.morale);
  const assignColonistRole = useGameStore((s) => s.assignColonistRole);

  const backdropRef = useRef<HTMLDivElement>(null);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === backdropRef.current) onClose();
  };

  const rolesConfig: RoleConfig[] = [
    {
      id: "engineer",
      titleKey: "colonists.roles.engineer.title",
      icon: "⚡",
      descriptionKey: "colonists.roles.engineer.desc",
      bonusText: (count) => `+${(count * 3).toFixed(0)}% ${t("colonists.roles.engineer.bonusLabel")}`,
    },
    {
      id: "scientist",
      titleKey: "colonists.roles.scientist.title",
      icon: "🔬",
      descriptionKey: "colonists.roles.scientist.desc",
      bonusText: (count) => `+${(count * 0.1).toFixed(1)} RP/tick`,
    },
    {
      id: "farmer",
      titleKey: "colonists.roles.farmer.title",
      icon: "🌿",
      descriptionKey: "colonists.roles.farmer.desc",
      bonusText: (count) => `+${(count * 4).toFixed(0)}% ${t("colonists.roles.farmer.bonusLabel")}`,
    },
    {
      id: "miner",
      titleKey: "colonists.roles.miner.title",
      icon: "⛏️",
      descriptionKey: "colonists.roles.miner.desc",
      bonusText: (count) => `+${(count * 5).toFixed(0)}% ${t("colonists.roles.miner.bonusLabel")}`,
    },
  ];

  const getMoraleEmoji = (val: number) => {
    if (val >= 75) return "😊";
    if (val < 30) return "😞";
    return "😐";
  };

  const getMoraleColor = (val: number) => {
    if (val >= 75) return "text-emerald-400";
    if (val < 30) return "text-rose-400";
    return "text-amber-400";
  };

  const getMoraleBarColor = (val: number) => {
    if (val >= 75) return "bg-emerald-500";
    if (val < 30) return "bg-rose-500";
    return "bg-amber-500";
  };

  const getMoraleEffectBadge = (multiplier: number) => {
    if (multiplier > 1.0) {
      return (
        <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-semibold">
          +{((multiplier - 1) * 100).toFixed(0)}% {t("colonists.productivityBonus")}
        </span>
      );
    }
    if (multiplier < 1.0) {
      return (
        <span className="px-2 py-0.5 rounded bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs font-semibold">
          {((multiplier - 1) * 100).toFixed(0)}% {t("colonists.productivityPenalty")}
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium">
        {t("colonists.productivityNormal")}
      </span>
    );
  };

  const unassignedCount = population.roles.unassigned;

  return createPortal(
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={t("colonists.title")}
    >
      <div
        className="relative flex flex-col w-full max-w-2xl max-h-[90vh] bg-slate-900/95 border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden text-slate-100 font-sans animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <span className="text-2xl">👥</span>
            <div>
              <h2 className="text-lg font-bold tracking-wide text-white">
                {t("colonists.title")}
              </h2>
              <p className="text-xs text-slate-400">
                {t("colonists.subtitle", {
                  total: population.total,
                  capacity: population.capacity,
                })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close") ?? "Close"}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top Morale & Satisfaction Grid */}
          <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{getMoraleEmoji(morale.value)}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-200">
                      {t("colonists.morale")}:
                    </span>
                    <span className={`text-base font-bold ${getMoraleColor(morale.value)}`}>
                      {morale.value}%
                    </span>
                  </div>
                  <div className="text-xs text-slate-400">
                    {t("colonists.moraleDescription")}
                  </div>
                </div>
              </div>
              <div>{getMoraleEffectBadge(morale.productivityMultiplier)}</div>
            </div>

            {/* Overall Morale Progress Bar */}
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${getMoraleBarColor(morale.value)}`}
                style={{ width: `${morale.value}%` }}
              />
            </div>

            {/* Sub-factors */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="bg-slate-900/80 border border-slate-800 rounded p-2 text-center">
                <div className="text-xs text-slate-400 mb-1">💨 {t("colonists.needs.o2")}</div>
                <div
                  className={`text-sm font-bold ${
                    morale.factors.o2Satisfaction >= 80
                      ? "text-cyan-400"
                      : morale.factors.o2Satisfaction >= 40
                      ? "text-amber-400"
                      : "text-rose-400"
                  }`}
                >
                  {morale.factors.o2Satisfaction}%
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded p-2 text-center">
                <div className="text-xs text-slate-400 mb-1">💧 {t("colonists.needs.water")}</div>
                <div
                  className={`text-sm font-bold ${
                    morale.factors.waterSatisfaction >= 80
                      ? "text-blue-400"
                      : morale.factors.waterSatisfaction >= 40
                      ? "text-amber-400"
                      : "text-rose-400"
                  }`}
                >
                  {morale.factors.waterSatisfaction}%
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded p-2 text-center">
                <div className="text-xs text-slate-400 mb-1">🍏 {t("colonists.needs.food")}</div>
                <div
                  className={`text-sm font-bold ${
                    morale.factors.foodSatisfaction >= 80
                      ? "text-emerald-400"
                      : morale.factors.foodSatisfaction >= 40
                      ? "text-amber-400"
                      : "text-rose-400"
                  }`}
                >
                  {morale.factors.foodSatisfaction}%
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded p-2 text-center">
                <div className="text-xs text-slate-400 mb-1">🏠 {t("colonists.needs.housing")}</div>
                <div
                  className={`text-sm font-bold ${
                    morale.factors.housingSatisfaction >= 100
                      ? "text-indigo-400"
                      : morale.factors.housingSatisfaction >= 60
                      ? "text-amber-400"
                      : "text-rose-400"
                  }`}
                >
                  {morale.factors.housingSatisfaction}%
                </div>
              </div>
            </div>
          </div>

          {/* Unassigned pool banner */}
          <div className="flex items-center justify-between bg-blue-950/30 border border-blue-800/50 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">🧑‍🚀</span>
              <div>
                <div className="text-sm font-semibold text-blue-200">
                  {t("colonists.roles.unassigned.title")}
                </div>
                <div className="text-xs text-blue-300/70">
                  {t("colonists.roles.unassigned.desc")}
                </div>
              </div>
            </div>
            <div className="text-lg font-bold text-blue-400 bg-blue-950/80 border border-blue-700/50 px-3 py-1 rounded-md">
              {unassignedCount}
            </div>
          </div>

          {/* Roles Allocation Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {t("colonists.professionsTitle")}
            </h3>

            <div className="space-y-2">
              {rolesConfig.map((role) => {
                const count = population.roles[role.id];
                const canAdd = unassignedCount > 0;
                const canRemove = count > 0;

                return (
                  <div
                    key={role.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-950/40 border border-slate-800 hover:border-slate-700 rounded-lg p-3 gap-3 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl p-2 bg-slate-900 border border-slate-800 rounded-lg">
                        {role.icon}
                      </span>
                      <div>
                        <div className="text-sm font-bold text-slate-200">
                          {t(role.titleKey)}
                        </div>
                        <div className="text-xs text-slate-400">{t(role.descriptionKey)}</div>
                        <div className="text-xs text-emerald-400 font-medium mt-0.5">
                          {role.bonusText(count)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => assignColonistRole(role.id, -1)}
                        disabled={!canRemove}
                        className="w-8 h-8 flex items-center justify-center rounded bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-30 disabled:hover:bg-slate-800 font-bold transition-colors"
                        aria-label={`Decrease ${t(role.titleKey)}`}
                      >
                        -
                      </button>
                      <span className="w-10 text-center font-mono text-base font-bold text-white">
                        {count}
                      </span>
                      <button
                        type="button"
                        onClick={() => assignColonistRole(role.id, 1)}
                        disabled={!canAdd}
                        className="w-8 h-8 flex items-center justify-center rounded bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-30 disabled:hover:bg-blue-600 font-bold transition-colors"
                        aria-label={`Increase ${t(role.titleKey)}`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Shuttle immigration info */}
          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs text-slate-400 flex items-start gap-2">
            <span className="text-base">🚀</span>
            <div>
              <span className="font-semibold text-slate-300">
                {t("colonists.shuttleTitle")}:
              </span>{" "}
              {t("colonists.shuttleDesc", {
                interval: ColonistService.SHUTTLE_INTERVAL_TICKS,
                max: ColonistService.SHUTTLE_MAX_ARRIVALS,
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-800 bg-slate-950/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition-colors"
          >
            {t("common.close") ?? "Zamknij"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
