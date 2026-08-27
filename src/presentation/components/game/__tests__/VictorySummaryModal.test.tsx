import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VictorySummaryModal } from "../VictorySummaryModal";
import { useGameStore } from "../../../../application/store/useGameStore";
import type { GameState } from "../../../../application/store/useGameStore";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock("../../../../application/store/useGameStore");

function mockGameStore(overrides: Partial<GameState> = {}) {
    const fakeState: Partial<GameState> = {
        tick: 300,
        sol: 6,
        terraforming: 75.5,
        o2Accumulated: 600,
        waterLevel: 0.7,
        resources: {
            power: 150,
            water: 120,
            o2: 180,
            biomass: 90,
        },
        placed: [
            { id: "b-1", definitionId: "hab", position: { x: 0, y: 0, z: 0 }, condition: 100, level: 1 },
            { id: "b-2", definitionId: "solar", position: { x: 5, y: 0, z: 5 }, condition: 100, level: 1 },
        ],
        aliensDefeated: 4,
        alienState: { wave: 1, ships: [], groundUnits: [], nextShipSpawnIn: 100, nextGroundSpawnIn: 80 },
        activeQuests: [
            { id: "quest-1", status: "completed", progress: {} },
            { id: "quest-2", status: "claimed", progress: {} },
            { id: "quest-3", status: "active", progress: {} },
        ],
        difficulty: "normal",
        colonyName: "New Olympus",
        analyticsSnapshots: [
            {
                tick: 0,
                sol: 1,
                resources: { energy: 10, water: 10, o2: 10, minerals: 2, biomass: 2 },
                terraforming: { o2: 0, temp: -60, waterLevel: -0.5, progress: 0 },
                buildingsCount: 1,
                aliensDefeated: 0,
            },
            {
                tick: 100,
                sol: 2,
                resources: { energy: 50, water: 40, o2: 60, minerals: 2, biomass: 20 },
                terraforming: { o2: 200, temp: -35, waterLevel: 0.1, progress: 30 },
                buildingsCount: 2,
                aliensDefeated: 1,
            },
            {
                tick: 300,
                sol: 6,
                resources: { energy: 150, water: 120, o2: 180, minerals: 2, biomass: 90 },
                terraforming: { o2: 600, temp: -3.5, waterLevel: 0.7, progress: 75.5 },
                buildingsCount: 2,
                aliensDefeated: 4,
            },
        ],
        ...overrides,
    };

    vi.mocked(useGameStore).mockImplementation(
        (selector: (state: GameState) => unknown) => selector(fakeState as GameState)
    );
}

describe("VictorySummaryModal", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders victory title, rank badge, score, and metrics in victory mode", () => {
        mockGameStore();
        render(
            <VictorySummaryModal
                isVictory={true}
                onPlayAgain={vi.fn()}
                onSelectScenario={vi.fn()}
                onContinueEndless={vi.fn()}
                onClose={vi.fn()}
            />
        );

        expect(screen.getByTestId("victory-summary-modal")).toBeDefined();
        expect(screen.getByText("summary.victoryTitle")).toBeDefined();
        expect(screen.getByTestId("colony-rank-badge")).toBeDefined();
        expect(screen.getByText("summary.metrics.survivedSols")).toBeDefined();
        expect(screen.getByText("summary.metrics.terraformingProgress")).toBeDefined();
        expect(screen.getByText("summary.metrics.totalResources")).toBeDefined();
        expect(screen.getByText("summary.metrics.aliensDefeated")).toBeDefined();
        expect(screen.getByText("summary.metrics.completedQuests")).toBeDefined();
        expect(screen.getByText("summary.metrics.buildingsCount")).toBeDefined();
        expect(screen.getByTestId("timeline-svg-chart")).toBeDefined();
    });

    it("renders defeat title and suppresses endless button in defeat mode", () => {
        mockGameStore();
        render(
            <VictorySummaryModal
                isVictory={false}
                onPlayAgain={vi.fn()}
                onSelectScenario={vi.fn()}
                onClose={vi.fn()}
            />
        );

        expect(screen.getByText("summary.defeatTitle")).toBeDefined();
        expect(screen.queryByTestId("continue-endless-btn")).toBeNull();
        expect(screen.getByTestId("play-again-btn")).toBeDefined();
        expect(screen.getByTestId("select-scenario-btn")).toBeDefined();
    });

    it("triggers onPlayAgain, onSelectScenario, and onContinueEndless when buttons are clicked", () => {
        mockGameStore();
        const onPlayAgain = vi.fn();
        const onSelectScenario = vi.fn();
        const onContinueEndless = vi.fn();
        const onClose = vi.fn();

        render(
            <VictorySummaryModal
                isVictory={true}
                onPlayAgain={onPlayAgain}
                onSelectScenario={onSelectScenario}
                onContinueEndless={onContinueEndless}
                onClose={onClose}
            />
        );

        fireEvent.click(screen.getByTestId("play-again-btn"));
        expect(onPlayAgain).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByTestId("select-scenario-btn"));
        expect(onSelectScenario).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByTestId("continue-endless-btn"));
        expect(onContinueEndless).toHaveBeenCalledTimes(1);
    });

    it("adheres to Modal Dismiss Rule: close button, backdrop click, and Escape key", () => {
        mockGameStore();
        const onClose = vi.fn();

        render(
            <VictorySummaryModal
                isVictory={true}
                onPlayAgain={vi.fn()}
                onSelectScenario={vi.fn()}
                onClose={onClose}
            />
        );

        // 1. Close button ✕
        fireEvent.click(screen.getByTestId("summary-close-btn"));
        expect(onClose).toHaveBeenCalledTimes(1);

        // 2. Backdrop click
        fireEvent.click(screen.getByTestId("victory-summary-modal-backdrop"));
        expect(onClose).toHaveBeenCalledTimes(2);

        // 3. Escape key press
        fireEvent.keyDown(window, { key: "Escape" });
        expect(onClose).toHaveBeenCalledTimes(3);
    });

    it("allows switching chart tabs between Terraforming, Resources, and Infrastructure", () => {
        mockGameStore();
        render(
            <VictorySummaryModal
                isVictory={true}
                onPlayAgain={vi.fn()}
                onSelectScenario={vi.fn()}
                onClose={vi.fn()}
            />
        );

        // Switch to Resources tab
        fireEvent.click(screen.getByText("summary.charts.tabResources"));
        expect(screen.getByText("summary.charts.seriesO2")).toBeDefined();
        expect(screen.getByText("summary.charts.seriesPower")).toBeDefined();

        // Switch to Infrastructure tab
        fireEvent.click(screen.getByText("summary.charts.tabInfrastructure"));
        expect(screen.getByText("summary.charts.seriesBuildings")).toBeDefined();
        expect(screen.getByText("summary.charts.seriesAliens")).toBeDefined();
    });
});
