import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuestTrackerWidget } from "../QuestTrackerWidget";
import { useGameStore } from "../../../../application/store/useGameStore";
import { QUEST_IDS } from "../../../../domain/config/quests";
import type { GameState } from "../../../../application/store/useGameStore";
import type { QuestState } from "../../../../domain/entities/Quest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params && params.current !== undefined) {
        return `${key}:${params.current}/${params.target}`;
      }
      return key;
    },
  }),
}));

vi.mock("../../../../application/store/useGameStore");

function mockStore(overrides: { activeQuests?: QuestState[]; claimQuestReward?: (id: string) => boolean } = {}) {
  const mockClaim = overrides.claimQuestReward ?? vi.fn().mockReturnValue(true);
  const defaultQuests: QuestState[] = [
    { id: QUEST_IDS.SOLAR_POWER, status: "active", progress: { obj_solar_1: 0 } },
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

describe("QuestTrackerWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the active tracked quest and progress", () => {
    mockStore();
    render(<QuestTrackerWidget onOpenLog={vi.fn()} />);

    expect(screen.getByText("quests.trackerTitle")).toBeDefined();
    expect(screen.getByText("quests.solar_power.title")).toBeDefined();
  });

  it("opens quest log modal when log button is clicked", () => {
    mockStore();
    const onOpenLog = vi.fn();
    render(<QuestTrackerWidget onOpenLog={onOpenLog} />);

    const openLogBtn = screen.getByTitle("quests.openLog");
    fireEvent.click(openLogBtn);
    expect(onOpenLog).toHaveBeenCalledTimes(1);
  });

  it("allows claiming rewards directly from widget when quest is completed", () => {
    const mockClaim = mockStore({
      activeQuests: [
        { id: QUEST_IDS.SOLAR_POWER, status: "completed", progress: { obj_solar_1: 1 } },
      ],
    });

    render(<QuestTrackerWidget onOpenLog={vi.fn()} />);

    const claimBtn = screen.getByText("quests.claimReward");
    fireEvent.click(claimBtn);
    expect(mockClaim).toHaveBeenCalledWith(QUEST_IDS.SOLAR_POWER);
  });

  it("toggles collapse state when expand/collapse button is clicked", () => {
    mockStore();
    render(<QuestTrackerWidget onOpenLog={vi.fn()} />);

    const toggleBtn = screen.getByTitle("quests.collapse");
    fireEvent.click(toggleBtn);

    // Objectives should be collapsed
    expect(screen.queryByText(/obj_solar_1/)).toBeNull();
  });
});
