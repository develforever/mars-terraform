import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScenarioSelectModal } from "../ScenarioSelectModal";
import { useGameStore } from "../../../../application/store/useGameStore";
import { useUIStore } from "../../../../application/store/useUIStore";
import { SCENARIOS } from "../../../../domain/config/scenarios";

const mockNavigate = vi.fn();

vi.mock("react-router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue || key,
  }),
}));

describe("ScenarioSelectModal", () => {
  const mockOnConfirm = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useGameStore.getState().resetGame();
    useUIStore.getState().resetUI();
  });

  it("renders modal header, close button, and all 5 scenarios", () => {
    render(<ScenarioSelectModal onConfirm={mockOnConfirm} onCancel={mockOnCancel} />);

    expect(screen.getByText("scenarios.title")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zamknij" })).toBeInTheDocument();

    for (const scenario of SCENARIOS) {
      expect(screen.getAllByText(scenario.title).length).toBeGreaterThan(0);
    }
  });

  it("selects a scenario and updates preview details, colony name, and seed", () => {
    render(<ScenarioSelectModal onConfirm={mockOnConfirm} onCancel={mockOnCancel} />);

    const olympus = SCENARIOS.find((s) => s.id === "scenario_olympus_rescue")!;
    const olympusBtn = screen.getByRole("radio", { name: new RegExp(olympus.title, "i") });
    fireEvent.click(olympusBtn);

    const colonyInput = screen.getByLabelText("scenarios.colonyName") as HTMLInputElement;
    expect(colonyInput.value).toBe(olympus.defaultColonyName);

    const seedInput = screen.getByLabelText("scenarios.seed") as HTMLInputElement;
    expect(Number(seedInput.value)).toBe(olympus.seed);
  });

  it("allows changing colony name and randomizing seed", () => {
    render(<ScenarioSelectModal onConfirm={mockOnConfirm} onCancel={mockOnCancel} />);

    const colonyInput = screen.getByLabelText("scenarios.colonyName") as HTMLInputElement;
    fireEvent.change(colonyInput, { target: { value: "Custom Outpost 99" } });
    expect(colonyInput.value).toBe("Custom Outpost 99");

    const diceBtn = screen.getByTitle("scenarios.randomize");
    fireEvent.click(diceBtn);

    const seedInput = screen.getByLabelText("scenarios.seed") as HTMLInputElement;
    expect(Number(seedInput.value)).toBeGreaterThan(0);
  });

  it("starts the scenario mission on button click", () => {
    render(<ScenarioSelectModal onConfirm={mockOnConfirm} onCancel={mockOnCancel} />);

    const alienScenario = SCENARIOS.find((s) => s.id === "scenario_alien_infestation")!;
    const alienBtn = screen.getByRole("radio", { name: new RegExp(alienScenario.title, "i") });
    fireEvent.click(alienBtn);

    const startBtn = screen.getByText("scenarios.startMission");
    fireEvent.click(startBtn);

    expect(mockOnConfirm).toHaveBeenCalledTimes(1);

    const gameState = useGameStore.getState();
    expect(gameState.currentScenarioId).toBe("scenario_alien_infestation");
    expect(gameState.difficulty).toBe(alienScenario.difficulty);
    expect(gameState.resources.power).toBe(alienScenario.startingResources.power);
    expect(gameState.alienState.wave).toBe(1);
  });

  it("satisfies the Modal & Popover Dismiss Rule: explicit '✕' button and Escape key", () => {
    const { unmount } = render(<ScenarioSelectModal onConfirm={mockOnConfirm} onCancel={mockOnCancel} />);

    // 1. Explicit '✕' button
    const closeBtn = screen.getByRole("button", { name: "Zamknij" });
    fireEvent.click(closeBtn);
    expect(mockOnCancel).toHaveBeenCalledTimes(1);

    // 2. Escape key
    fireEvent.keyDown(window, { key: "Escape" });
    expect(mockOnCancel).toHaveBeenCalledTimes(2);

    unmount();
  });

  it("closes when back button is clicked", () => {
    render(<ScenarioSelectModal onConfirm={mockOnConfirm} onCancel={mockOnCancel} />);

    const backBtn = screen.getByText("scenarios.back");
    fireEvent.click(backBtn);
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });
});
