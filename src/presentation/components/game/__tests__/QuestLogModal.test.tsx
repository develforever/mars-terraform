import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuestLogModal } from "../QuestLogModal";
import { useGameStore } from "../../../../application/store/useGameStore";
import { QUEST_IDS } from "../../../../domain/config/quests";
import type { GameState } from "../../../../application/store/useGameStore";
import type { QuestState } from "../../../../domain/entities/Quest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../../../../application/store/useGameStore");

function mockStore(overrides: { activeQuests?: QuestState[]; claimQuestReward?: (id: string) => boolean } = {}) {
  const mockClaim = overrides.claimQuestReward ?? vi.fn().mockReturnValue(true);
  const defaultQuests: QuestState[] = [
    { id: QUEST_IDS.SOLAR_POWER, status: "completed", progress: { obj_solar_1: 1 } },
    { id: QUEST_IDS.ICE_WATER, status: "active", progress: { obj_ice_1: 0 } },
    { id: QUEST_IDS.O2_GENERATOR, status: "locked", progress: {} },
  ];

  const fakeState: Partial<GameState> = {
    activeQuests: overrides.activeQuests ?? defaultQuests,
    claimQuestReward: mockClaim,
  };

  vi.mocked(useGameStore).mockImplementation(
    (selector: (state: GameState) => unknown) => selector(fakeState as GameState)
  );

  return mockClaim;
}

describe("QuestLogModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the quest log dialog with title and category tabs", () => {
    mockStore();
    render(<QuestLogModal onClose={vi.fn()} />);

    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText("quests.title")).toBeDefined();
    expect(screen.getByText("quests.filter.all")).toBeDefined();
    expect(screen.getByText("quests.filter.colony_start")).toBeDefined();
  });

  it("calls onClose when ✕ button is clicked (Dismiss Rule)", () => {
    mockStore();
    const onClose = vi.fn();
    render(<QuestLogModal onClose={onClose} />);

    const closeBtn = screen.getByLabelText("Zamknij");
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when backdrop is clicked (Dismiss Rule)", () => {
    mockStore();
    const onClose = vi.fn();
    render(<QuestLogModal onClose={onClose} />);

    const backdrop = screen.getByRole("dialog");
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape key is pressed (Dismiss Rule)", () => {
    mockStore();
    const onClose = vi.fn();
    render(<QuestLogModal onClose={onClose} />);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("filters quests by clicking category tabs", () => {
    mockStore();
    render(<QuestLogModal onClose={vi.fn()} />);

    // Click 'defense' tab
    const defenseTab = screen.getByText("quests.filter.defense");
    fireEvent.click(defenseTab);

    // Defense quest title should be visible
    expect(screen.getAllByText("quests.defense_grid.title").length).toBeGreaterThanOrEqual(1);
    // Solar power (colony start) should not be visible in defense tab
    expect(screen.queryByText("quests.solar_power.title")).toBeNull();
  });

  it("shows claim button on completed quest and triggers claimQuestReward", () => {
    const mockClaim = mockStore({
      activeQuests: [
        { id: QUEST_IDS.SOLAR_POWER, status: "completed", progress: { obj_solar_1: 1 } },
      ],
    });

    render(<QuestLogModal onClose={vi.fn()} />);

    const claimBtn = screen.getByText(/quests.claimReward/);
    expect(claimBtn).toBeDefined();

    fireEvent.click(claimBtn);
    expect(mockClaim).toHaveBeenCalledWith(QUEST_IDS.SOLAR_POWER);
  });
});
