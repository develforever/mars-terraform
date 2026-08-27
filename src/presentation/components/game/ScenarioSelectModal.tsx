import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useGameStore } from "../../../application/store/useGameStore";
import { useUIStore } from "../../../application/store/useUIStore";
import { SCENARIOS } from "../../../domain/config/scenarios";
import type { Scenario } from "../../../domain/entities/Scenario";
import "./ScenarioSelectModal.css";

export interface ScenarioSelectModalProps {
    onConfirm: () => void;
    onCancel: () => void;
}

export const ScenarioSelectModal: React.FC<ScenarioSelectModalProps> = ({ onConfirm, onCancel }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const startScenarioGame = useGameStore((s) => s.startScenarioGame);
    const resetUI = useUIStore((s) => s.resetUI);
    const setLaunching = useUIStore((s) => s.setLaunching);

    const [selectedScenario, setSelectedScenario] = useState<Scenario>(SCENARIOS[0]);
    const [colonyName, setColonyName] = useState<string>(SCENARIOS[0].defaultColonyName || "");
    const [seed, setSeed] = useState<number>(SCENARIOS[0].seed);
    const [isLaunching, setIsLaunching] = useState<boolean>(false);

    // Update default colony name and seed when scenario changes
    const handleSelectScenario = (sc: Scenario) => {
        setSelectedScenario(sc);
        setColonyName(sc.defaultColonyName || "");
        setSeed(sc.seed);
    };

    const handleRandomSeed = () => {
        setSeed(Math.floor(Math.random() * 99999) + 1);
    };

    const handleStartMission = useCallback(() => {
        if (isLaunching) return;
        setIsLaunching(true);
        resetUI();

        const finalName = colonyName.trim() || selectedScenario.defaultColonyName || selectedScenario.title;
        startScenarioGame(selectedScenario, finalName, seed);
        setLaunching(true);
        onConfirm();

        setTimeout(() => {
            setLaunching(false);
            navigate("/mars");
        }, 3000);
    }, [isLaunching, resetUI, colonyName, selectedScenario, seed, startScenarioGame, setLaunching, onConfirm, navigate]);

    // Modal & Popover Dismiss Rule: Escape key handler
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !isLaunching) {
                onCancel();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isLaunching, onCancel]);

    const getDifficultyBadgeClass = (diff: Scenario["difficulty"]) => {
        switch (diff) {
            case "easy":
                return "scenario-badge--easy";
            case "hard":
                return "scenario-badge--hard";
            case "normal":
            default:
                return "scenario-badge--normal";
        }
    };

    return (
        <div className="scenario-modal relative" role="dialog" aria-modal="true" aria-labelledby="scenario-modal-title">
            {/* Explicit Close Button '✕' */}
            <button
                type="button"
                onClick={onCancel}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors text-lg p-1 rounded hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-red-500"
                aria-label="Zamknij"
                disabled={isLaunching}
            >
                ✕
            </button>

            {/* Header */}
            <div className="scenario-modal__header">
                <div>
                    <h2 id="scenario-modal-title" className="scenario-modal__title">
                        <span>🚀</span>
                        <span>{t("scenarios.title")}</span>
                    </h2>
                    <p className="scenario-modal__subtitle">{t("scenarios.subtitle")}</p>
                </div>
            </div>

            {/* Content Grid */}
            <div className="scenario-modal__grid">
                {/* Scenario List */}
                <div className="scenario-modal__list" role="radiogroup" aria-label="Wybór scenariusza">
                    {SCENARIOS.map((sc) => {
                        const isSelected = selectedScenario.id === sc.id;
                        const scTitle = t(`scenarios.${sc.id}.title`, { defaultValue: sc.title });
                        const scDesc = t(`scenarios.${sc.id}.desc`, { defaultValue: sc.description });

                        return (
                            <button
                                key={sc.id}
                                type="button"
                                onClick={() => handleSelectScenario(sc)}
                                className={`scenario-card ${isSelected ? "scenario-card--selected" : ""}`}
                                aria-checked={isSelected}
                                role="radio"
                                disabled={isLaunching}
                            >
                                <div className="scenario-card__header">
                                    <div className="scenario-card__title-row">
                                        <span className="text-xl" aria-hidden="true">{sc.icon || "🪐"}</span>
                                        <span>{scTitle}</span>
                                    </div>
                                    <span className={`scenario-badge ${getDifficultyBadgeClass(sc.difficulty)}`}>
                                        {t(`start.difficulty_label.${sc.difficulty}`)}
                                    </span>
                                </div>
                                <p className="scenario-card__desc">{scDesc}</p>
                                {sc.tags && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {sc.tags.map((tag) => (
                                            <span key={tag} className="text-[10px] bg-zinc-800/80 text-zinc-400 px-2 py-0.5 rounded">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Scenario Detail View */}
                <div className="scenario-detail">
                    {/* Title & Archetype Header */}
                    <div className="flex items-start justify-between border-b border-zinc-800 pb-3">
                        <div>
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <span>{selectedScenario.icon || "🪐"}</span>
                                <span>{t(`scenarios.${selectedScenario.id}.title`, { defaultValue: selectedScenario.title })}</span>
                            </h3>
                            <div className="text-xs text-zinc-400 mt-1 flex items-center gap-2">
                                <span>{t("scenarios.terrainArchetype")}:</span>
                                <span className="text-red-400 font-semibold">
                                    {t(`scenarios.archetypes.${selectedScenario.terrainArchetype}`, { defaultValue: selectedScenario.terrainArchetype })}
                                </span>
                                <span>•</span>
                                <span>Promień: R{selectedScenario.mapRadius}</span>
                            </div>
                        </div>
                        <span className={`scenario-badge ${getDifficultyBadgeClass(selectedScenario.difficulty)}`}>
                            {t(`start.difficulty_label.${selectedScenario.difficulty}`)}
                        </span>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-zinc-300 leading-relaxed">
                        {t(`scenarios.${selectedScenario.id}.desc`, { defaultValue: selectedScenario.description })}
                    </p>

                    {/* Starting Resources */}
                    <div>
                        <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                            {t("scenarios.startingResources")}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div className="bg-zinc-900/80 border border-zinc-800 p-2 rounded flex flex-col items-center">
                                <span className="text-xs text-zinc-400">💨 O₂</span>
                                <span className="text-sm font-bold text-cyan-400">{selectedScenario.startingResources.o2 ?? 5}</span>
                            </div>
                            <div className="bg-zinc-900/80 border border-zinc-800 p-2 rounded flex flex-col items-center">
                                <span className="text-xs text-zinc-400">⚡ {t("hud.resource_labels.power").split(" ")[1] || "Energia"}</span>
                                <span className="text-sm font-bold text-yellow-400">{selectedScenario.startingResources.power ?? 5}</span>
                            </div>
                            <div className="bg-zinc-900/80 border border-zinc-800 p-2 rounded flex flex-col items-center">
                                <span className="text-xs text-zinc-400">💧 {t("hud.resource_labels.water").split(" ")[1] || "Woda"}</span>
                                <span className="text-sm font-bold text-blue-400">{selectedScenario.startingResources.water ?? 3}</span>
                            </div>
                            <div className="bg-zinc-900/80 border border-zinc-800 p-2 rounded flex flex-col items-center">
                                <span className="text-xs text-zinc-400">🧪 {t("hud.resource_labels.biomass").split(" ")[1] || "Biomasa"}</span>
                                <span className="text-sm font-bold text-green-400">{selectedScenario.startingResources.biomass ?? 1}</span>
                            </div>
                        </div>
                    </div>

                    {/* Modifiers & POIs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Modifiers */}
                        <div className="bg-zinc-900/60 border border-zinc-800 p-3 rounded-lg">
                            <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                                {t("scenarios.modifiers")}
                            </div>
                            <ul className="text-xs space-y-1 text-zinc-300">
                                {selectedScenario.modifiers.stormFrequency !== undefined && (
                                    <li className="flex items-center gap-1.5">
                                        <span>🌪️</span>
                                        <span>{t("scenarios.stormFreq", { val: selectedScenario.modifiers.stormFrequency })}</span>
                                    </li>
                                )}
                                {selectedScenario.modifiers.alienAggression !== undefined && (
                                    <li className="flex items-center gap-1.5">
                                        <span>👾</span>
                                        <span>{t("scenarios.alienAggr", { val: selectedScenario.modifiers.alienAggression })}</span>
                                    </li>
                                )}
                                {selectedScenario.modifiers.solarEfficiency !== undefined && (
                                    <li className="flex items-center gap-1.5">
                                        <span>☀️</span>
                                        <span>{t("scenarios.solarEff", { val: Math.round(selectedScenario.modifiers.solarEfficiency * 100) })}</span>
                                    </li>
                                )}
                                {selectedScenario.modifiers.initialAlienWave !== undefined && selectedScenario.modifiers.initialAlienWave > 0 && (
                                    <li className="flex items-center gap-1.5 text-red-400 font-medium">
                                        <span>⚠️</span>
                                        <span>{t("scenarios.initialAlienWave", { val: selectedScenario.modifiers.initialAlienWave })}</span>
                                    </li>
                                )}
                            </ul>
                        </div>

                        {/* POI Prefabs */}
                        <div className="bg-zinc-900/60 border border-zinc-800 p-3 rounded-lg">
                            <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                                {t("scenarios.customPOIs")}
                            </div>
                            <ul className="text-xs space-y-1 text-zinc-300">
                                {selectedScenario.customPOIs.map((poi, idx) => (
                                    <li key={`${poi.model}-${idx}`} className="flex items-center gap-1.5">
                                        <span>📍</span>
                                        <span>
                                            {t(`scenarios.poiLabels.${poi.model}`, { defaultValue: poi.model })}
                                            {poi.count && poi.count > 1 ? ` (×${poi.count})` : ""}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Objectives */}
                    {selectedScenario.objectives && selectedScenario.objectives.length > 0 && (
                        <div>
                            <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                                {t("scenarios.objectives")}
                            </div>
                            <ul className="text-xs space-y-1.5 bg-zinc-900/40 p-3 rounded border border-zinc-800/80">
                                {selectedScenario.objectives.map((obj, i) => (
                                    <li key={i} className="flex items-start gap-2 text-zinc-300">
                                        <span className="text-emerald-400">✓</span>
                                        <span>{obj}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Inputs: Colony Name & Seed */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-zinc-800">
                        <div>
                            <label htmlFor="scenario-colony-name" className="block text-xs text-zinc-400 mb-1">
                                {t("scenarios.colonyName")}
                            </label>
                            <input
                                id="scenario-colony-name"
                                type="text"
                                className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-red-500"
                                value={colonyName}
                                onChange={(e) => setColonyName(e.target.value)}
                                disabled={isLaunching}
                            />
                        </div>

                        <div>
                            <label htmlFor="scenario-seed-input" className="block text-xs text-zinc-400 mb-1">
                                {t("scenarios.seed")}
                            </label>
                            <div className="flex gap-2">
                                <input
                                    id="scenario-seed-input"
                                    type="number"
                                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-red-500"
                                    value={seed}
                                    onChange={(e) => setSeed(Number(e.target.value))}
                                    disabled={isLaunching}
                                />
                                <button
                                    type="button"
                                    onClick={handleRandomSeed}
                                    disabled={isLaunching}
                                    className="px-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded border border-zinc-700 transition-colors"
                                    title={t("scenarios.randomize")}
                                    aria-label={t("scenarios.randomize")}
                                >
                                    🎲
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="scenario-modal__actions">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isLaunching}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-medium transition-colors"
                >
                    {t("scenarios.back")}
                </button>
                <button
                    type="button"
                    onClick={handleStartMission}
                    disabled={isLaunching || !colonyName.trim()}
                    className="px-6 py-2 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-bold rounded-lg text-sm transition-all shadow-lg shadow-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {t("scenarios.startMission")}
                </button>
            </div>
        </div>
    );
};
