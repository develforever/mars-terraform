import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ResearchTreeModal } from "../ResearchTreeModal";
import { useGameStore } from "../../../../application/store/useGameStore";
import { TECH_IDS } from "../../../../domain/config/technologies";
import type { GameState } from "../../../../application/store/useGameStore";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../../../../application/store/useGameStore");

// ── Helpers ──────────────────────────────────────────────────────────────────

type StoreOverrides = Partial<{
  researchPoints: number;
  unlockedTechs: string[];
  purchaseTech: (id: string) => boolean;
}>;

function mockStore(overrides: StoreOverrides = {}) {
  const mockPurchase = vi.fn().mockReturnValue(true);
  const fakeState: Partial<GameState> = {
    researchPoints: overrides.researchPoints ?? 0,
    unlockedTechs: overrides.unlockedTechs ?? [TECH_IDS.BASIC_STRUCTURES],
    purchaseTech: overrides.purchaseTech ?? mockPurchase,
  };
  vi.mocked(useGameStore).mockImplementation(
    (selector: (state: GameState) => unknown) => selector(fakeState as GameState)
  );
  return mockPurchase;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ResearchTreeModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the modal title", () => {
    mockStore();
    render(<ResearchTreeModal onClose={vi.fn()} />);
    expect(screen.getByRole("dialog")).toBeDefined();
    // title key should be present
    expect(screen.getByText("research.title")).toBeDefined();
  });

  it("calls onClose when ✕ button is clicked", () => {
    mockStore();
    const onClose = vi.fn();
    render(<ResearchTreeModal onClose={onClose} />);
    const closeBtn = screen.getByLabelText("Zamknij");
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when backdrop is clicked", () => {
    mockStore();
    const onClose = vi.fn();
    render(<ResearchTreeModal onClose={onClose} />);
    const backdrop = screen.getByRole("dialog");
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape key is pressed", () => {
    mockStore();
    const onClose = vi.fn();
    render(<ResearchTreeModal onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders research point balance", () => {
    mockStore({ researchPoints: 42.5 });
    render(<ResearchTreeModal onClose={vi.fn()} />);
    expect(screen.getByText("42.5")).toBeDefined();
  });

  it("shows Zbadaj button for affordable available tech", () => {
    // advanced_hab costs 30 RP; prereq basic_structures is met; player has 50 RP
    mockStore({
      researchPoints: 50,
      unlockedTechs: [TECH_IDS.BASIC_STRUCTURES],
    });
    render(<ResearchTreeModal onClose={vi.fn()} />);
    // The research button text is the translated key
    const buttons = screen.getAllByText("research.researchBtn");
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("calls purchaseTech when research button is clicked", () => {
    const mockPurchase = mockStore({
      researchPoints: 100,
      unlockedTechs: [TECH_IDS.BASIC_STRUCTURES],
    });
    render(<ResearchTreeModal onClose={vi.fn()} />);
    const researchBtns = screen.getAllByText("research.researchBtn");
    // Click the first available research button
    fireEvent.click(researchBtns[0]);
    expect(mockPurchase).toHaveBeenCalledTimes(1);
  });

  it("does not show research button when RP is insufficient (tech shows as locked)", () => {
    // advanced_hab costs 30 RP — player only has 5
    mockStore({
      researchPoints: 5,
      unlockedTechs: [TECH_IDS.BASIC_STRUCTURES],
    });
    render(<ResearchTreeModal onClose={vi.fn()} />);
    // When RP is insufficient, tech status is 'locked' so no research button is rendered
    const researchBtns = screen.queryAllByText("research.researchBtn");
    expect(researchBtns).toHaveLength(0);
  });

  it("shows researched status for already unlocked techs", () => {
    mockStore({
      unlockedTechs: [TECH_IDS.BASIC_STRUCTURES, TECH_IDS.SOLAR_ARRAY],
    });
    render(<ResearchTreeModal onClose={vi.fn()} />);
    // The researched badge text contains "research.status.researched"
    const badges = screen.getAllByText("✓ research.status.researched");
    // At least BASIC_STRUCTURES and SOLAR_ARRAY are shown as researched
    expect(badges.length).toBeGreaterThanOrEqual(2);
  });

  it("highlights the target tech node when selectedTechId is provided", () => {
    mockStore({
      researchPoints: 50,
      unlockedTechs: [TECH_IDS.BASIC_STRUCTURES],
    });
    render(<ResearchTreeModal onClose={vi.fn()} selectedTechId={TECH_IDS.ADVANCED_HAB} />);
    const node = document.querySelector(`[data-tech-id="${TECH_IDS.ADVANCED_HAB}"]`);
    expect(node).not.toBeNull();
    expect(node?.className).toContain("ring-[#58a6ff]");
  });
});
