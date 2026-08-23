import React, { useEffect, useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useGameStore } from "../../../application/store/useGameStore";
import { CAMPAIGN_QUESTS } from "../../../domain/config/quests";
import { QuestService } from "../../../domain/services/QuestService";
import type { QuestCategory, QuestDefinition, QuestStatus } from "../../../domain/entities/Quest";

export interface QuestLogModalProps {
  onClose: () => void;
}

type FilterCategory = "all" | QuestCategory;

const CATEGORY_TABS: { id: FilterCategory; labelKey: string; icon: string }[] = [
  { id: "all", labelKey: "quests.filter.all", icon: "📋" },
  { id: "colony_start", labelKey: "quests.filter.colony_start", icon: "🚀" },
  { id: "self_sufficiency", labelKey: "quests.filter.self_sufficiency", icon: "🌱" },
  { id: "defense", labelKey: "quests.filter.defense", icon: "🛡️" },
  { id: "green_mars", labelKey: "quests.filter.green_mars", icon: "🌍" },
];

export const QuestLogModal: React.FC<QuestLogModalProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<FilterCategory>("all");
  const backdropRef = useRef<HTMLDivElement>(null);

  const activeQuests = useGameStore((state) => state.activeQuests);
  const claimQuestReward = useGameStore((state) => state.claimQuestReward);

  // Dismiss Rule: Escape key closes modal
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

  // Dismiss Rule: Backdrop click closes modal
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === backdropRef.current) onClose();
  };

  const getStatusBadge = (status: QuestStatus) => {
    switch (status) {
      case "completed":
        return (
          <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-[#238636]/20 border border-[#3fb950] text-[#3fb950] animate-pulse">
            {t("quests.completed")}
          </span>
        );
      case "claimed":
        return (
          <span className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-[#21262d] border border-[#30363d] text-[#8b949e]">
            {t("quests.claimed")}
          </span>
        );
      case "active":
        return (
          <span className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-[#1f6feb]/20 border border-[#58a6ff] text-[#58a6ff]">
            {t("quests.active")}
          </span>
        );
      case "locked":
        return (
          <span className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-[#21262d]/50 border border-[#30363d] text-[#6e7681]">
            🔒 {t("quests.locked")}
          </span>
        );
    }
  };

  const questStateMap = new Map(activeQuests.map((q) => [q.id, q]));

  const filteredQuests = CAMPAIGN_QUESTS.filter((quest) => {
    if (activeTab === "all") return true;
    return quest.category === activeTab;
  });

  return createPortal(
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={t("quests.title")}
    >
      <div
        className="relative bg-[#0d1117] border border-[#30363d] rounded-2xl shadow-2xl w-[min(95vw,900px)] max-h-[88vh] flex flex-col overflow-hidden text-white animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#30363d] shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📜</span>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">
                {t("quests.title")}
              </h2>
              <p className="text-xs text-[#8b949e]">
                {t("quests.trackerTitle")} — Mars Campaign Engine
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-[#8b949e] hover:text-white hover:bg-[#21262d] rounded-lg transition-colors text-base"
            aria-label="Zamknij"
          >
            ✕
          </button>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-[#21262d] bg-[#161b22] shrink-0 overflow-x-auto">
          {CATEGORY_TABS.map((tab) => {
            const count = CAMPAIGN_QUESTS.filter((q) => tab.id === "all" || q.category === tab.id).length;
            const completedInTab = CAMPAIGN_QUESTS.filter((q) => {
              if (tab.id !== "all" && q.category !== tab.id) return false;
              const s = questStateMap.get(q.id);
              return s?.status === "completed" || s?.status === "claimed";
            }).length;

            const isSelected = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  isSelected
                    ? "bg-[#238636] text-white shadow-sm"
                    : "bg-[#21262d] text-[#8b949e] hover:text-white hover:bg-[#30363d]"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{t(tab.labelKey)}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 opacity-90 font-mono">
                  {completedInTab}/{count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Quest List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {filteredQuests.length === 0 ? (
            <div className="text-center py-12 text-[#8b949e] text-sm">
              {t("quests.noQuestsInCategory")}
            </div>
          ) : (
            filteredQuests.map((questDef: QuestDefinition) => {
              const qState = questStateMap.get(questDef.id);
              const status: QuestStatus = qState?.status ?? "locked";
              const summary = QuestService.getProgressSummary(questDef, qState);

              const isLocked = status === "locked";
              const isCompleted = status === "completed";
              const isClaimed = status === "claimed";

              return (
                <div
                  key={questDef.id}
                  className={`border rounded-xl p-4.5 transition-all ${
                    isCompleted
                      ? "bg-[#1f2937]/50 border-[#3fb950] shadow-lg shadow-green-950/20"
                      : isClaimed
                      ? "bg-[#161b22]/40 border-[#21262d] opacity-75"
                      : isLocked
                      ? "bg-[#0d1117] border-[#21262d] opacity-60"
                      : "bg-[#161b22] border-[#30363d] hover:border-[#58a6ff]/50"
                  }`}
                >
                  {/* Top Bar: Badges and Title */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-[#21262d] font-bold text-[#58a6ff]">
                          {t("quests.stage", { stage: questDef.stage })}
                        </span>
                        {questDef.isMainQuest ? (
                          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-[#e3b341]/20 text-[#f2cc60] font-bold">
                            ⭐ {t("quests.mainQuest")}
                          </span>
                        ) : (
                          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-[#21262d] text-[#8b949e]">
                            {t("quests.sideQuest")}
                          </span>
                        )}
                        {getStatusBadge(status)}
                      </div>
                      <h3 className="text-sm font-bold text-white">
                        {t(questDef.titleKey)}
                      </h3>
                    </div>

                    {/* Claim Button */}
                    {isCompleted && (
                      <button
                        type="button"
                        onClick={() => claimQuestReward(questDef.id)}
                        className="px-4 py-1.5 bg-[#238636] hover:bg-[#2ea043] text-white font-bold rounded-lg text-xs shadow-md transition-all shrink-0 active:scale-95"
                      >
                        🎁 {t("quests.claimReward")}
                      </button>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-xs text-[#8b949e] mb-3 leading-relaxed">
                    {t(questDef.descriptionKey)}
                  </p>

                  {/* Objectives Progress */}
                  {!isLocked && (
                    <div className="space-y-2 mb-3 bg-[#0d1117]/60 p-3 rounded-lg border border-[#21262d]">
                      {summary.objectives.map((obj) => (
                        <div key={obj.id} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span
                              className={
                                obj.completed
                                  ? "text-[#3fb950] font-medium"
                                  : "text-[#c9d1d9]"
                              }
                            >
                              {obj.completed ? "✓ " : "○ "}
                              {t(obj.descriptionKey, {
                                current: obj.current,
                                target: obj.target,
                              })}
                            </span>
                            <span className="text-[#8b949e] font-mono text-[11px]">
                              {obj.current} / {obj.target}
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-[#21262d] rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                obj.completed ? "bg-[#3fb950]" : "bg-[#58a6ff]"
                              }`}
                              style={{
                                width: `${Math.min(
                                  100,
                                  (obj.current / obj.target) * 100
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Prerequisites info if locked */}
                  {isLocked && questDef.prerequisites.length > 0 && (
                    <div className="text-[11px] text-[#8b949e] mb-2">
                      <span className="text-[#f85149] font-medium">🔒 {t("quests.prereqRequired")}</span>{" "}
                      {questDef.prerequisites
                        .map((prereqId) => {
                          const prereqDef = CAMPAIGN_QUESTS.find((q) => q.id === prereqId);
                          return prereqDef ? t(prereqDef.titleKey) : prereqId;
                        })
                        .join(", ")}
                    </div>
                  )}

                  {/* Rewards Footer */}
                  <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-[#21262d]/60 text-[11px]">
                    <span className="text-[#8b949e] font-medium">
                      {t("quests.rewardsLabel")}
                    </span>
                    {questDef.reward.resources?.power && (
                      <span className="px-2 py-0.5 rounded bg-[#fde68a]/10 text-[#fde68a] border border-[#fde68a]/20">
                        ⚡ +{questDef.reward.resources.power} Power
                      </span>
                    )}
                    {questDef.reward.resources?.water && (
                      <span className="px-2 py-0.5 rounded bg-[#60a5fa]/10 text-[#60a5fa] border border-[#60a5fa]/20">
                        💧 +{questDef.reward.resources.water} Water
                      </span>
                    )}
                    {questDef.reward.resources?.biomass && (
                      <span className="px-2 py-0.5 rounded bg-[#86efac]/10 text-[#86efac] border border-[#86efac]/20">
                        🧪 +{questDef.reward.resources.biomass} Bio
                      </span>
                    )}
                    {questDef.reward.resources?.o2 && (
                      <span className="px-2 py-0.5 rounded bg-[#67e8f9]/10 text-[#67e8f9] border border-[#67e8f9]/20">
                        💨 +{questDef.reward.resources.o2} O₂
                      </span>
                    )}
                    {questDef.reward.researchPoints && (
                      <span className="px-2 py-0.5 rounded bg-[#58a6ff]/10 text-[#58a6ff] border border-[#58a6ff]/20 font-bold">
                        🔬 +{questDef.reward.researchPoints} RP
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
