import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useGameStore } from "../../../application/store/useGameStore";
import { GameAnalyticsService } from "../../../domain/services/GameAnalyticsService";
import type { GameAnalyticsSnapshot, ColonyRank } from "../../../domain/entities/GameStats";

export interface VictorySummaryModalProps {
    isVictory: boolean;
    onPlayAgain: () => void;
    onSelectScenario: () => void;
    onContinueEndless?: () => void;
    onClose: () => void;
}

type ChartTab = "terraforming" | "resources" | "infrastructure";

interface ChartSeriesConfig {
    key: string;
    label: string;
    color: string;
    getValue: (s: GameAnalyticsSnapshot) => number;
    unit?: string;
}

export const VictorySummaryModal: React.FC<VictorySummaryModalProps> = ({
    isVictory,
    onPlayAgain,
    onSelectScenario,
    onContinueEndless,
    onClose,
}) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<ChartTab>("terraforming");
    const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

    // Extract relevant game state from store
    const tick = useGameStore((s) => s.tick);
    const sol = useGameStore((s) => s.sol);
    const terraforming = useGameStore((s) => s.terraforming);
    const o2Accumulated = useGameStore((s) => s.o2Accumulated);
    const waterLevel = useGameStore((s) => s.waterLevel);
    const resources = useGameStore((s) => s.resources);
    const placed = useGameStore((s) => s.placed);
    const aliensDefeated = useGameStore((s) => s.aliensDefeated);
    const alienWave = useGameStore((s) => s.alienState.wave);
    const activeQuests = useGameStore((s) => s.activeQuests);
    const difficulty = useGameStore((s) => s.difficulty);
    const colonyName = useGameStore((s) => s.colonyName);
    const rawSnapshots = useGameStore((s) => s.analyticsSnapshots);

    // Ensure we have at least one snapshot for charting
    const snapshots: GameAnalyticsSnapshot[] = useMemo(() => {
        if (rawSnapshots && rawSnapshots.length > 0) {
            return rawSnapshots;
        }
        return [
            GameAnalyticsService.createSnapshot({
                tick,
                resources,
                terraforming,
                o2Accumulated,
                waterLevel,
                buildingsCount: placed.length,
                aliensDefeated,
            }),
        ];
    }, [rawSnapshots, tick, resources, terraforming, o2Accumulated, waterLevel, placed.length, aliensDefeated]);

    // Calculate score breakdown and summary stats
    const summaryStats = useMemo(() => {
        const completedQuestsCount = activeQuests.filter((q) => q.status === "completed" || q.status === "claimed").length;
        return GameAnalyticsService.getSummaryStats(
            {
                tick,
                sol,
                terraforming,
                o2Accumulated,
                waterLevel,
                resources,
                placedCount: placed.length,
                aliensDefeated,
                alienWave,
                completedQuestsCount,
                totalQuestsCount: activeQuests.length || 10,
                difficulty,
                won: isVictory,
            },
            snapshots
        );
    }, [
        tick,
        sol,
        terraforming,
        o2Accumulated,
        waterLevel,
        resources,
        placed.length,
        aliensDefeated,
        alienWave,
        activeQuests,
        difficulty,
        isVictory,
        snapshots,
    ]);

    // Modal & Popover Dismiss Rule: Escape key handler
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    // Rank styling attributes
    const rankConfig: Record<ColonyRank, { badgeColor: string; bgGradient: string; icon: string; borderGlow: string }> = {
        platinum: {
            badgeColor: "text-cyan-300 border-cyan-400 bg-cyan-950/70 shadow-[0_0_25px_rgba(6,182,212,0.45)]",
            bgGradient: "from-cyan-900/30 via-purple-900/20 to-zinc-950",
            icon: "💎",
            borderGlow: "border-cyan-500/50",
        },
        gold: {
            badgeColor: "text-amber-300 border-amber-400 bg-amber-950/70 shadow-[0_0_25px_rgba(245,158,11,0.4)]",
            bgGradient: "from-amber-900/30 via-yellow-900/15 to-zinc-950",
            icon: "🏆",
            borderGlow: "border-amber-500/50",
        },
        silver: {
            badgeColor: "text-slate-200 border-slate-300 bg-slate-800/80 shadow-[0_0_20px_rgba(203,213,225,0.3)]",
            bgGradient: "from-slate-800/40 via-zinc-900/40 to-zinc-950",
            icon: "🥈",
            borderGlow: "border-slate-400/40",
        },
        bronze: {
            badgeColor: "text-amber-600 border-amber-700 bg-amber-950/50 shadow-[0_0_15px_rgba(180,83,9,0.25)]",
            bgGradient: "from-orange-950/30 via-zinc-900/30 to-zinc-950",
            icon: "🥉",
            borderGlow: "border-amber-700/40",
        },
    };

    const currentRank = summaryStats.score.rank;
    const rankStyle = rankConfig[currentRank];

    // Chart Series Definitions
    const chartSeriesConfigs: Record<ChartTab, ChartSeriesConfig[]> = {
        terraforming: [
            { key: "tf_progress", label: t("summary.charts.seriesTerraforming"), color: "#22c55e", getValue: (s) => s.terraforming.progress, unit: "%" },
            { key: "tf_temp", label: t("summary.charts.seriesTemp"), color: "#f97316", getValue: (s) => s.terraforming.temp, unit: "°C" },
            { key: "tf_water", label: t("summary.charts.seriesWater"), color: "#06b6d4", getValue: (s) => s.terraforming.waterLevel, unit: "m" },
        ],
        resources: [
            { key: "res_o2", label: t("summary.charts.seriesO2"), color: "#38bdf8", getValue: (s) => s.resources.o2 },
            { key: "res_power", label: t("summary.charts.seriesPower"), color: "#eab308", getValue: (s) => s.resources.energy },
            { key: "res_water", label: t("summary.charts.seriesWaterRes"), color: "#3b82f6", getValue: (s) => s.resources.water },
            { key: "res_biomass", label: t("summary.charts.seriesBiomass"), color: "#10b981", getValue: (s) => s.resources.biomass },
        ],
        infrastructure: [
            { key: "inf_buildings", label: t("summary.charts.seriesBuildings"), color: "#a855f7", getValue: (s) => s.buildingsCount },
            { key: "inf_aliens", label: t("summary.charts.seriesAliens"), color: "#ef4444", getValue: (s) => s.aliensDefeated },
        ],
    };

    const activeSeries = chartSeriesConfigs[activeTab];

    // SVG Chart Geometry
    const svgWidth = 640;
    const svgHeight = 175;
    const padding = { top: 15, right: 20, bottom: 25, left: 45 };
    const chartWidth = svgWidth - padding.left - padding.right;
    const chartHeight = svgHeight - padding.top - padding.bottom;

    // Determine Y scale bounds for active tab
    const { minY, maxY } = useMemo(() => {
        let min = Infinity;
        let max = -Infinity;
        snapshots.forEach((s) => {
            activeSeries.forEach((series) => {
                const val = series.getValue(s);
                if (val < min) min = val;
                if (val > max) max = val;
            });
        });
        if (min === Infinity || max === -Infinity) {
            min = 0;
            max = 100;
        }
        if (min === max) {
            min = Math.min(0, min - 10);
            max = max + 10;
        }
        const range = max - min;
        const paddedMin = min < 0 ? min - range * 0.05 : 0;
        const paddedMax = max + range * 0.1;
        return { minY: paddedMin, maxY: paddedMax };
    }, [snapshots, activeSeries]);

    const getYCoord = (val: number) => {
        if (maxY === minY) return padding.top + chartHeight / 2;
        const normalized = (val - minY) / (maxY - minY);
        return padding.top + chartHeight - normalized * chartHeight;
    };

    const getXCoord = (index: number) => {
        if (snapshots.length <= 1) return padding.left + chartWidth / 2;
        return padding.left + (index / (snapshots.length - 1)) * chartWidth;
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md animate-fade-in"
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    onClose();
                }
            }}
            data-testid="victory-summary-modal-backdrop"
        >
            <div
                className={`relative w-full max-w-4xl bg-zinc-950/95 border ${rankStyle.borderGlow} rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh] text-zinc-100 bg-gradient-to-b ${rankStyle.bgGradient}`}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="summary-modal-title"
                data-testid="victory-summary-modal"
            >
                {/* Close Button (Escape, ✕, backdrop click compliance) */}
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute top-4 right-4 z-20 text-zinc-400 hover:text-white bg-zinc-900/70 hover:bg-zinc-800 p-2 rounded-full transition-colors border border-zinc-700/60"
                    aria-label={t("summary.actions.close")}
                    data-testid="summary-close-btn"
                >
                    ✕
                </button>

                {/* Header Section */}
                <div className="p-5 sm:p-6 pb-4 border-b border-zinc-800/80">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-3">
                                <span className="text-3xl sm:text-4xl" aria-hidden="true">
                                    {isVictory ? "🌍" : "💀"}
                                </span>
                                <div>
                                    <h2 id="summary-modal-title" className={`text-xl sm:text-2xl font-black uppercase tracking-wider ${isVictory ? "text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.4)]" : "text-rose-400 drop-shadow-[0_0_12px_rgba(251,113,133,0.4)]"}`}>
                                        {isVictory ? t("summary.victoryTitle") : t("summary.defeatTitle")}
                                    </h2>
                                    <p className="text-xs text-zinc-400 mt-0.5">
                                        {isVictory ? t("summary.victorySubtitle") : t("summary.defeatSubtitle")}
                                        {colonyName && <span className="ml-2 font-semibold text-zinc-300">| {colonyName}</span>}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Rank Badge */}
                        <div className={`flex items-center gap-3 px-4 py-2 rounded-xl border ${rankStyle.badgeColor} transition-transform`} data-testid="colony-rank-badge">
                            <span className="text-2xl" aria-hidden="true">{rankStyle.icon}</span>
                            <div>
                                <div className="text-[10px] uppercase font-bold tracking-widest opacity-80">{t("summary.rank")}</div>
                                <div className="text-xs sm:text-sm font-extrabold uppercase tracking-wide">
                                    {t(`summary.rank_${currentRank}`)}
                                </div>
                            </div>
                            <div className="pl-3 border-l border-current/30 text-right">
                                <div className="text-[10px] uppercase opacity-75">{t("summary.score")}</div>
                                <div className="text-sm sm:text-base font-black font-mono">
                                    {summaryStats.score.totalScore.toLocaleString()} <span className="text-[10px] font-normal">{t("summary.points")}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Body Content - Scrollable without horizontal scroll */}
                <div className="p-4 sm:p-6 space-y-5 overflow-y-auto overflow-x-hidden flex-1 custom-scrollbar">
                    {/* Metrics Tiles Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                        <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-3 flex flex-col justify-between min-w-0">
                            <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 truncate">
                                <span>📅</span> <span className="truncate">{t("summary.metrics.survivedSols")}</span>
                            </div>
                            <div className="text-lg sm:text-xl font-bold font-mono text-white mt-1">
                                {summaryStats.survivedSols}
                            </div>
                        </div>

                        <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-3 flex flex-col justify-between min-w-0">
                            <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 truncate">
                                <span>🌍</span> <span className="truncate">{t("summary.metrics.terraformingProgress")}</span>
                            </div>
                            <div className="text-lg sm:text-xl font-bold font-mono text-emerald-400 mt-1">
                                {summaryStats.terraformingProgress}%
                            </div>
                        </div>

                        <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-3 flex flex-col justify-between min-w-0">
                            <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 truncate">
                                <span>📦</span> <span className="truncate">{t("summary.metrics.totalResources")}</span>
                            </div>
                            <div className="text-lg sm:text-xl font-bold font-mono text-amber-300 mt-1">
                                {summaryStats.totalResources.toLocaleString()}
                            </div>
                        </div>

                        <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-3 flex flex-col justify-between min-w-0">
                            <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 truncate">
                                <span>👾</span> <span className="truncate">{t("summary.metrics.aliensDefeated")}</span>
                            </div>
                            <div className="text-lg sm:text-xl font-bold font-mono text-rose-400 mt-1">
                                {summaryStats.aliensDefeated}
                            </div>
                        </div>

                        <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-3 flex flex-col justify-between min-w-0">
                            <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 truncate">
                                <span>📜</span> <span className="truncate">{t("summary.metrics.completedQuests")}</span>
                            </div>
                            <div className="text-lg sm:text-xl font-bold font-mono text-cyan-400 mt-1">
                                {summaryStats.completedQuests} / {summaryStats.totalQuests}
                            </div>
                        </div>

                        <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-3 flex flex-col justify-between min-w-0">
                            <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 truncate">
                                <span>🏗️</span> <span className="truncate">{t("summary.metrics.buildingsCount")}</span>
                            </div>
                            <div className="text-lg sm:text-xl font-bold font-mono text-purple-400 mt-1">
                                {summaryStats.buildingsCount}
                            </div>
                        </div>
                    </div>

                    {/* Timeline History SVG Chart */}
                    <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 sm:p-4 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-xs sm:text-sm font-bold text-zinc-200 flex items-center gap-2">
                                <span>📈</span> {t("summary.charts.title")}
                            </h3>

                            {/* Series Category Selector Tabs */}
                            <div className="flex bg-zinc-950/80 border border-zinc-800 rounded-lg p-0.5 text-xs">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab("terraforming")}
                                    className={`px-2.5 py-1 rounded-md transition-colors ${activeTab === "terraforming" ? "bg-zinc-800 text-white font-semibold shadow" : "text-zinc-400 hover:text-zinc-200"}`}
                                >
                                    {t("summary.charts.tabTerraforming")}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab("resources")}
                                    className={`px-2.5 py-1 rounded-md transition-colors ${activeTab === "resources" ? "bg-zinc-800 text-white font-semibold shadow" : "text-zinc-400 hover:text-zinc-200"}`}
                                >
                                    {t("summary.charts.tabResources")}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab("infrastructure")}
                                    className={`px-2.5 py-1 rounded-md transition-colors ${activeTab === "infrastructure" ? "bg-zinc-800 text-white font-semibold shadow" : "text-zinc-400 hover:text-zinc-200"}`}
                                >
                                    {t("summary.charts.tabInfrastructure")}
                                </button>
                            </div>
                        </div>

                        {/* Interactive Pure SVG Line Chart */}
                        <div className="relative w-full overflow-hidden">
                            <svg
                                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                                className="w-full h-40 sm:h-48 overflow-visible select-none"
                                data-testid="timeline-svg-chart"
                            >
                                <defs>
                                    {activeSeries.map((series) => (
                                        <linearGradient key={`grad-${series.key}`} id={`grad-${series.key}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                            <stop offset="0%" stopColor={series.color} stopOpacity="0.25" />
                                            <stop offset="100%" stopColor={series.color} stopOpacity="0.0" />
                                        </linearGradient>
                                    ))}
                                </defs>

                                {/* Horizontal Grid Lines & Y Axis Labels */}
                                {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                                    const yVal = minY + (1 - pct) * (maxY - minY);
                                    const yPos = padding.top + pct * chartHeight;
                                    return (
                                        <g key={`grid-y-${pct}`}>
                                            <line
                                                x1={padding.left}
                                                y1={yPos}
                                                x2={padding.left + chartWidth}
                                                y2={yPos}
                                                stroke="rgba(255, 255, 255, 0.08)"
                                                strokeDasharray="3 3"
                                            />
                                            <text
                                                x={padding.left - 6}
                                                y={yPos + 3}
                                                textAnchor="end"
                                                fontSize="9"
                                                fill="#71717a"
                                                className="font-mono"
                                            >
                                                {yVal >= 1000 ? `${(yVal / 1000).toFixed(1)}k` : yVal.toFixed(0)}
                                            </text>
                                        </g>
                                    );
                                })}

                                {/* X Axis Grid & Labels */}
                                {snapshots.map((s, idx) => {
                                    if (snapshots.length > 8 && idx % Math.ceil(snapshots.length / 6) !== 0 && idx !== snapshots.length - 1) {
                                        return null;
                                    }
                                    const xPos = getXCoord(idx);
                                    return (
                                        <g key={`grid-x-${s.tick}`}>
                                            <line
                                                x1={xPos}
                                                y1={padding.top}
                                                x2={xPos}
                                                y2={padding.top + chartHeight}
                                                stroke="rgba(255, 255, 255, 0.06)"
                                            />
                                            <text
                                                x={xPos}
                                                y={padding.top + chartHeight + 15}
                                                textAnchor="middle"
                                                fontSize="9"
                                                fill="#71717a"
                                                className="font-mono"
                                            >
                                                {t("summary.charts.solAxis")} {s.sol}
                                            </text>
                                        </g>
                                    );
                                })}

                                {/* Render Area Fills & Polyline Curves */}
                                {activeSeries.map((series, sIdx) => {
                                    const points = snapshots.map((s, idx) => ({
                                        x: getXCoord(idx),
                                        y: getYCoord(series.getValue(s)),
                                    }));

                                    const pointsString = points.map((p) => `${p.x},${p.y}`).join(" ");

                                    // Area path closed to bottom
                                    const firstPoint = points[0];
                                    const lastPoint = points[points.length - 1];
                                    const baseY = padding.top + chartHeight;
                                    const areaPath = `M ${firstPoint.x} ${baseY} L ${pointsString.replace(/ /g, " L ")} L ${lastPoint.x} ${baseY} Z`;

                                    return (
                                        <g key={`series-group-${series.key}`}>
                                            {/* Primary series area gradient fill */}
                                            {sIdx === 0 && (
                                                <path d={areaPath} fill={`url(#grad-${series.key})`} />
                                            )}

                                            {/* Line */}
                                            <polyline
                                                fill="none"
                                                stroke={series.color}
                                                strokeWidth="2.2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                points={pointsString}
                                            />

                                            {/* Data Points */}
                                            {points.map((p, pIdx) => (
                                                <circle
                                                    key={`pt-${series.key}-${pIdx}`}
                                                    cx={p.x}
                                                    cy={p.y}
                                                    r={hoveredPointIndex === pIdx ? 4.5 : 2.5}
                                                    fill={series.color}
                                                    stroke="#09090b"
                                                    strokeWidth="1.5"
                                                    className="transition-all duration-150 cursor-pointer"
                                                    onMouseEnter={() => setHoveredPointIndex(pIdx)}
                                                    onMouseLeave={() => setHoveredPointIndex(null)}
                                                />
                                            ))}
                                        </g>
                                    );
                                })}
                            </svg>
                        </div>

                        {/* Chart Legend */}
                        <div className="flex flex-wrap items-center justify-center gap-3 pt-1 border-t border-zinc-800/60 text-xs">
                            {activeSeries.map((series) => (
                                <div key={`legend-${series.key}`} className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: series.color }} />
                                    <span className="text-zinc-300 font-medium">{series.label}</span>
                                    {hoveredPointIndex !== null && snapshots[hoveredPointIndex] && (
                                        <span className="font-mono text-white font-bold ml-0.5">
                                            : {series.getValue(snapshots[hoveredPointIndex])} {series.unit ?? ""}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Score Breakdown Section */}
                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3.5 sm:p-4">
                        <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2.5">
                            {t("summary.breakdown.title")}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                            <div className="flex justify-between items-center px-3 py-2 rounded bg-zinc-950/60 border border-zinc-800/60 min-w-0">
                                <span className="text-zinc-400 truncate mr-1.5">{t("summary.breakdown.terraforming")}:</span>
                                <span className="font-mono font-bold text-emerald-400 shrink-0">+{summaryStats.score.terraformingScore}</span>
                            </div>
                            <div className="flex justify-between items-center px-3 py-2 rounded bg-zinc-950/60 border border-zinc-800/60 min-w-0">
                                <span className="text-zinc-400 truncate mr-1.5">{t("summary.breakdown.survival")}:</span>
                                <span className="font-mono font-bold text-blue-400 shrink-0">+{summaryStats.score.survivalScore}</span>
                            </div>
                            <div className="flex justify-between items-center px-3 py-2 rounded bg-zinc-950/60 border border-zinc-800/60 min-w-0">
                                <span className="text-zinc-400 truncate mr-1.5">{t("summary.breakdown.resources")}:</span>
                                <span className="font-mono font-bold text-amber-400 shrink-0">+{summaryStats.score.resourceScore}</span>
                            </div>
                            <div className="flex justify-between items-center px-3 py-2 rounded bg-zinc-950/60 border border-zinc-800/60 min-w-0">
                                <span className="text-zinc-400 truncate mr-1.5">{t("summary.breakdown.alien")}:</span>
                                <span className="font-mono font-bold text-rose-400 shrink-0">+{summaryStats.score.alienScore}</span>
                            </div>
                            <div className="flex justify-between items-center px-3 py-2 rounded bg-zinc-950/60 border border-zinc-800/60 min-w-0">
                                <span className="text-zinc-400 truncate mr-1.5">{t("summary.breakdown.quests")}:</span>
                                <span className="font-mono font-bold text-cyan-400 shrink-0">+{summaryStats.score.questScore}</span>
                            </div>
                            <div className="flex justify-between items-center px-3 py-2 rounded bg-zinc-950/60 border border-zinc-800/60 min-w-0">
                                <span className="text-zinc-400 truncate mr-1.5">{t("summary.breakdown.buildings")}:</span>
                                <span className="font-mono font-bold text-purple-400 shrink-0">+{summaryStats.score.buildingScore}</span>
                            </div>
                            <div className="flex justify-between items-center px-3 py-2 rounded bg-zinc-950/60 border border-zinc-800/60 min-w-0">
                                <span className="text-zinc-400 truncate mr-1.5">{t("summary.breakdown.difficultyMultiplier")}:</span>
                                <span className="font-mono font-bold text-zinc-200 shrink-0">×{summaryStats.score.difficultyMultiplier.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center px-3 py-2 rounded bg-emerald-950/40 border border-emerald-800/50 min-w-0">
                                <span className="text-emerald-300 font-bold truncate mr-1.5">{t("summary.score")}:</span>
                                <span className="font-mono font-black text-emerald-400 text-sm shrink-0">{summaryStats.score.totalScore.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Action Buttons */}
                <div className="p-4 sm:p-5 border-t border-zinc-800/80 bg-zinc-950/90 flex flex-wrap items-center justify-end gap-2.5">
                    {isVictory && onContinueEndless && (
                        <button
                            type="button"
                            onClick={onContinueEndless}
                            className="px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-emerald-700/80 hover:bg-emerald-600 text-white border border-emerald-500/50 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_20px_rgba(16,185,129,0.5)]"
                            data-testid="continue-endless-btn"
                        >
                            ♾️ {t("summary.actions.continueEndless")}
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={onSelectScenario}
                        className="px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
                        data-testid="select-scenario-btn"
                    >
                        🚀 {t("summary.actions.selectScenario")}
                    </button>

                    <button
                        type="button"
                        onClick={onPlayAgain}
                        className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white border border-orange-400/50 transition-all shadow-[0_0_15px_rgba(249,115,22,0.35)]"
                        data-testid="play-again-btn"
                    >
                        🔄 {t("summary.actions.playAgain")}
                    </button>
                </div>
            </div>
        </div>
    );
};
