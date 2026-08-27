import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ColonistManagerModal } from "../ColonistManagerModal";
import { useGameStore } from "../../../../application/store/useGameStore";
import type { GameState } from "../../../../application/store/useGameStore";
import type { ColonyPopulation, MoraleState } from "../../../../domain/entities/Colonist";

// Mocks
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (options?.total !== undefined && options?.capacity !== undefined) {
        return `${options.total} / ${options.capacity}`;
      }
      return key;
    },
  }),
}));

vi.mock("../../../../application/store/useGameStore");

interface StoreOverrides {
  population?: ColonyPopulation;
  morale?: MoraleState;
  assignColonistRole?: (role: string, delta: number) => void;
}

function mockStore(overrides: StoreOverrides = {}) {
  const mockAssign = vi.fn();
  const defaultPopulation: ColonyPopulation = {
    total: 10,
    capacity: 20,
    roles: {
      unassigned: 2,
      engineer: 3,
      scientist: 2,
      farmer: 2,
      miner: 1,
    },
  };

  const defaultMorale: MoraleState = {
    value: 85,
    factors: {
      foodSatisfaction: 90,
      waterSatisfaction: 85,
      o2Satisfaction: 100,
      housingSatisfaction: 100,
    },
    productivityMultiplier: 1.15,
  };

  const fakeState: Partial<GameState> = {
    population: overrides.population ?? defaultPopulation,
    morale: overrides.morale ?? defaultMorale,
    assignColonistRole: overrides.assignColonistRole ?? mockAssign,
  };

  vi.mocked(useGameStore).mockImplementation(
    (selector: (state: GameState) => unknown) => selector(fakeState as GameState)
  );

  return { mockAssign };
}

describe("ColonistManagerModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders modal dialog, title and population count", () => {
    mockStore();
    render(<ColonistManagerModal onClose={vi.fn()} />);

    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText("colonists.title")).toBeDefined();
    expect(screen.getByText("10 / 20")).toBeDefined();
    expect(screen.getAllByText("85%").length).toBeGreaterThanOrEqual(1);
  });

  it("calls onClose when ✕ button is clicked", () => {
    mockStore();
    const onClose = vi.fn();
    render(<ColonistManagerModal onClose={onClose} />);

    const closeBtn = screen.getByLabelText("common.close");
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when backdrop is clicked", () => {
    mockStore();
    const onClose = vi.fn();
    render(<ColonistManagerModal onClose={onClose} />);

    const backdrop = screen.getByRole("dialog");
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape key is pressed", () => {
    mockStore();
    const onClose = vi.fn();
    render(<ColonistManagerModal onClose={onClose} />);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls assignColonistRole when clicking increase/decrease buttons", () => {
    const { mockAssign } = mockStore();
    render(<ColonistManagerModal onClose={vi.fn()} />);

    const increaseEngineerBtn = screen.getByLabelText("Increase colonists.roles.engineer.title");
    fireEvent.click(increaseEngineerBtn);
    expect(mockAssign).toHaveBeenCalledWith("engineer", 1);

    const decreaseEngineerBtn = screen.getByLabelText("Decrease colonists.roles.engineer.title");
    fireEvent.click(decreaseEngineerBtn);
    expect(mockAssign).toHaveBeenCalledWith("engineer", -1);
  });

  it("disables increase buttons when unassigned count is 0", () => {
    mockStore({
      population: {
        total: 8,
        capacity: 10,
        roles: {
          unassigned: 0,
          engineer: 2,
          scientist: 2,
          farmer: 2,
          miner: 2,
        },
      },
    });

    render(<ColonistManagerModal onClose={vi.fn()} />);
    const increaseEngineerBtn = screen.getByLabelText("Increase colonists.roles.engineer.title");
    expect(increaseEngineerBtn).toHaveProperty("disabled", true);
  });

  it("disables decrease buttons when a role has 0 assigned", () => {
    mockStore({
      population: {
        total: 5,
        capacity: 10,
        roles: {
          unassigned: 5,
          engineer: 0,
          scientist: 0,
          farmer: 0,
          miner: 0,
        },
      },
    });

    render(<ColonistManagerModal onClose={vi.fn()} />);
    const decreaseEngineerBtn = screen.getByLabelText("Decrease colonists.roles.engineer.title");
    expect(decreaseEngineerBtn).toHaveProperty("disabled", true);
  });
});
