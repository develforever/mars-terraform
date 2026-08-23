import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useGameStore } from "../../../application/store/useGameStore";
import { QuestService } from "../../../domain/services/QuestService";

interface QuestTrackerWidgetProps {
  onOpenLog: () => void;
}

export const QuestTrackerWidget: React.FC<QuestTrackerWidgetProps> = ({ onOpenLog }) => {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);

  const activeQuests = useGameStore((state) => state.activeQuests);
  const claimQuestReward = useGameStore((state) => state.claimQuestReward);

  const tracked = QuestService.getTrackedQuest(activeQuests);
  const hasUnclaimed = QuestService.hasUnclaimedRewards(activeQuests);

  if (!tracked) return null;

  const { questDef, state: questState } = tracked;
  const summary = QuestService.getProgressSummary(questDef, questState);
  const isCompleted = questState.status === "completed";
  const isClaimed = questState.status === "claimed";

  return (
    <aside
      aria-label={t("quests.trackerTitle")}
      className="absolute top-16 right-4 z-20 w-72 md:w-80 bg-[#0d1117]/90 border border-[#30363d] backdrop-blur-md rounded-xl p-3.5 shadow-2xl text-white select-none transition-all duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-[#21262d] pb-2 mb-2.5">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="text-lg">📜</span>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#8b949e]">
              {t("quests.trackerTitle")}
            </span>
            <h2 className="text-xs font-bold text-[#e6edf3] truncate" title={t(questDef.titleKey)}>
              {t(questDef.titleKey)}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onOpenLog}
            className={`relative px-2 py-1 text-xs rounded-md border font-medium transition-colors ${
              hasUnclaimed
                ? "bg-[#238636] border-[#3fb950] text-white animate-pulse"
                : "bg-[#21262d] border-[#30363d] text-[#c9d1d9] hover:bg-[#30363d]"
            }`}
            title={t("quests.openLog")}
          >
            {t("quests.openLog")}
            {hasUnclaimed && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#f85149] rounded-full ring-2 ring-[#0d1117]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            className="w-6 h-6 flex items-center justify-center text-[#8b949e] hover:text-white hover:bg-[#21262d] rounded-md transition-colors text-xs"
            title={collapsed ? t("quests.expand") : t("quests.collapse")}
          >
            {collapsed ? "▼" : "▲"}
          </button>
        </div>
      </div>

      {/* Body content */}
      {!collapsed && (
        <div className="space-y-2.5 text-xs">
          <p className="text-[#8b949e] text-[11px] leading-relaxed line-clamp-2">
            {t(questDef.descriptionKey)}
          </p>

          {/* Objectives */}
          <div className="space-y-1.5 pt-1">
            {summary.objectives.map((obj) => (
              <div key={obj.id} className="space-y-0.5">
                <div className="flex justify-between items-center text-[11px]">
                  <span
                    className={`truncate pr-2 ${
                      obj.completed ? "text-[#3fb950] line-through opacity-80" : "text-[#c9d1d9]"
                    }`}
                  >
                    {obj.completed ? "✓ " : "• "}
                    {t(obj.descriptionKey, { current: obj.current, target: obj.target })}
                  </span>
                  <span className="text-[#8b949e] font-mono shrink-0">
                    {obj.current}/{obj.target}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 bg-[#21262d] rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      obj.completed ? "bg-[#3fb950]" : "bg-[#58a6ff]"
                    }`}
                    style={{ width: `${Math.min(100, (obj.current / obj.target) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Reward claiming */}
          {isCompleted && (
            <button
              type="button"
              onClick={() => claimQuestReward(questDef.id)}
              className="w-full mt-2 py-1.5 px-3 bg-gradient-to-r from-[#238636] to-[#2ea043] hover:from-[#2ea043] hover:to-[#3fb950] text-white font-bold rounded-lg shadow-lg shadow-green-900/40 text-xs flex items-center justify-center gap-1.5 transition-all transform active:scale-98"
            >
              <span>🎁</span>
              <span>{t("quests.claimReward")}</span>
            </button>
          )}

          {isClaimed && (
            <div className="text-center py-1 text-[11px] text-[#3fb950] font-semibold bg-[#238636]/10 rounded border border-[#238636]/20">
              {t("quests.claimed")}
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
