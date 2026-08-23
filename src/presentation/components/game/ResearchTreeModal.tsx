import { useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useGameStore } from "../../../application/store/useGameStore";
import { TECHNOLOGY_LIST, TECH_CATEGORIES, TECHNOLOGIES } from "../../../domain/config/technologies";
import type { TechCategory } from "../../../domain/config/technologies";
import { BUILDING_DEFINITIONS } from "../../../domain/config/buildings";
import { ResearchService } from "../../../domain/services/ResearchService";

// props
interface ResearchTreeModalProps {
  onClose: () => void;
}

// constants
const CATEGORY_ICONS: Record<TechCategory, string> = {
  foundations:  "🏗️",
  biology:      "🌿",
  energy:       "⚡",
  mining:       "⛏️",
  terraforming: "🌍",
  defense:      "🛡️",
};

type TechStatus = "researched" | "available" | "locked";

// main logic
export function ResearchTreeModal({ onClose }: ResearchTreeModalProps) {
  const { t } = useTranslation();
  const researchPoints = useGameStore((s) => s.researchPoints);
  const unlockedTechs  = useGameStore((s) => s.unlockedTechs);
  const purchaseTech   = useGameStore((s) => s.purchaseTech);

  const backdropRef = useRef<HTMLDivElement>(null);

  // Escape key closes the modal
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  // Backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === backdropRef.current) onClose();
  };

  const getTechStatus = (techId: string): TechStatus => {
    if (unlockedTechs.includes(techId)) return "researched";
    const check = ResearchService.canResearch(techId, researchPoints, unlockedTechs);
    return check.allowed ? "available" : "locked";
  };

  const handlePurchase = (techId: string) => {
    purchaseTech(techId);
  };

  // render logic
  return createPortal(
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={t("research.title")}
    >
      <div
        className="relative bg-[#0d1117] border border-[#30363d] rounded-xl shadow-2xl w-[min(95vw,1100px)] max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#30363d] shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔬</span>
            <h2 className="text-xl font-bold text-white">{t("research.title")}</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-[#8b949e] flex items-center gap-1.5">
              <span className="text-[#58a6ff] font-bold text-base">{researchPoints.toFixed(1)}</span>
              <span>{t("research.points")}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-[#8b949e] hover:text-white hover:bg-[#21262d] rounded-lg transition-colors"
              aria-label="Zamknij"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-4 px-6 py-2 border-b border-[#21262d] shrink-0 text-xs">
          <span className="flex items-center gap-1.5 text-[#3fb950]">
            <span className="w-3 h-3 rounded-full bg-[#238636] inline-block" />
            {t("research.status.researched")}
          </span>
          <span className="flex items-center gap-1.5 text-[#f0c040]">
            <span className="w-3 h-3 rounded-full bg-[#f0c040] inline-block" />
            {t("research.status.available")}
          </span>
          <span className="flex items-center gap-1.5 text-[#484f58]">
            <span className="w-3 h-3 rounded-full bg-[#484f58] inline-block" />
            {t("research.status.locked")}
          </span>
        </div>

        {/* Tree grid — scrollable */}
        <div className="overflow-auto flex-1 p-4">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${TECH_CATEGORIES.length}, minmax(160px, 1fr))` }}>
            {TECH_CATEGORIES.map((cat) => {
              const techsInCat = TECHNOLOGY_LIST.filter((t) => t.category === cat);
              return (
                <div key={cat} className="flex flex-col gap-3">
                  {/* Category header */}
                  <div className="flex items-center gap-2 pb-2 border-b border-[#21262d]">
                    <span className="text-lg">{CATEGORY_ICONS[cat]}</span>
                    <span className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider">
                      {t(`research.category.${cat}`)}
                    </span>
                  </div>

                  {/* Tech nodes */}
                  {techsInCat.map((tech) => {
                    const status = getTechStatus(tech.id);
                    const canBuy = status === "available";
                    const prereqNames = tech.prereqs.map(
                      (id) => TECHNOLOGIES[id]?.name ?? id
                    );

                    return (
                      <TechNode
                        key={tech.id}
                        id={tech.id}
                        name={tech.name}
                        description={tech.description}
                        costRP={tech.costRP}
                        status={status}
                        prereqNames={prereqNames}
                        unlockEffects={tech.unlockEffects}
                        unlocksBuildings={tech.unlocksBuildings}
                        currentRP={researchPoints}
                        canBuy={canBuy}
                        onPurchase={() => handlePurchase(tech.id)}
                        t={t}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── TechNode sub-component ───────────────────────────────────────────────────

interface TechNodeProps {
  id: string;
  name: string;
  description: string;
  costRP: number;
  status: TechStatus;
  prereqNames: string[];
  unlockEffects?: string;
  unlocksBuildings: string[];
  currentRP: number;
  canBuy: boolean;
  onPurchase: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

const STATUS_STYLES: Record<TechStatus, string> = {
  researched: "border-[#238636] bg-[#0d1117]",
  available:  "border-[#f0c040] bg-[#161b22] hover:bg-[#1c2128]",
  locked:     "border-[#30363d] bg-[#0d1117] opacity-60",
};

const STATUS_DOT: Record<TechStatus, string> = {
  researched: "bg-[#238636]",
  available:  "bg-[#f0c040] animate-pulse",
  locked:     "bg-[#484f58]",
};

function TechNode({
  id, name, description, costRP, status, prereqNames, unlockEffects, unlocksBuildings,
  currentRP, canBuy, onPurchase, t,
}: TechNodeProps) {
  const canAfford = currentRP >= costRP;

  return (
    <div
      className={`rounded-lg border p-3 flex flex-col gap-2 transition-all ${STATUS_STYLES[status]}`}
    >
      {/* Status dot + name */}
      <div className="flex items-start gap-2">
        <span className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[status]}`} />
        <span className="text-sm font-medium text-white leading-tight">{name}</span>
      </div>

      {/* Description */}
      <p className="text-[11px] text-[#8b949e] leading-snug">{description}</p>

      {/* Unlock effects */}
      {unlockEffects && (
        <p className="text-[10px] text-[#58a6ff] leading-snug">{unlockEffects}</p>
      )}

      {/* 3D Model thumbnails for unlocked buildings / units */}
      {unlocksBuildings.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          {unlocksBuildings.map((bId) => {
            const bDef = BUILDING_DEFINITIONS[bId];
            return (
              <div
                key={bId}
                className="flex items-center gap-1 bg-[#161b22] border border-[#30363d] rounded px-1.5 py-0.5"
                title={bDef?.name || bId}
              >
                <img
                  src={`/icons/buildings/${bId}.webp`}
                  alt={bDef?.name || bId}
                  className="w-4 h-4 object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
                <span className="text-[10px] text-gray-300 font-medium">{bDef?.name || bId}</span>
              </div>
            );
          })}
        </div>
      )}

      {id === "drone_logistics" && (
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          <div
            className="flex items-center gap-1 bg-[#161b22] border border-[#30363d] rounded px-1.5 py-0.5"
            title="Dron Logistyczny"
          >
            <img
              src="/icons/units/drone.webp"
              alt="Dron"
              className="w-4 h-4 object-contain"
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
            <span className="text-[10px] text-gray-300 font-medium">Dron</span>
          </div>
        </div>
      )}

      {/* Prereqs */}
      {prereqNames.length > 0 && (
        <p className="text-[10px] text-[#8b949e]">
          🔗 {t("research.prereqs")}: {prereqNames.join(", ")}
        </p>
      )}

      {/* Cost / researched badge */}
      {status === "researched" ? (
        <div className="text-[11px] text-[#3fb950] font-semibold">✓ {t("research.status.researched")}</div>
      ) : costRP === 0 ? null : (
        <div className={`text-[11px] font-semibold ${canAfford ? "text-[#f0c040]" : "text-[#da3633]"}`}>
          🔬 {costRP} {t("research.rp")}
          {!canAfford && ` (${t("research.insufficientRP")})`}
        </div>
      )}

      {/* Purchase button — only for available techs */}
      {canBuy && costRP > 0 && (
        <button
          type="button"
          disabled={!canAfford}
          onClick={onPurchase}
          className={`mt-1 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
            canAfford
              ? "bg-[#f0c040] text-black hover:bg-[#f5d060] cursor-pointer"
              : "bg-[#21262d] text-[#484f58] cursor-not-allowed"
          }`}
        >
          {t("research.researchBtn")}
        </button>
      )}
    </div>
  );
}
