import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BuildingPalette } from "../BuildingPalette";
import { useGameStore } from "../../../../application/store/useGameStore";
import { TECH_IDS } from "../../../../domain/config/technologies";
import type { GameState } from "../../../../application/store/useGameStore";
import type { Resources } from "../../../../domain/entities/Resources";
import type { PlacedBuilding } from "../../../../domain/entities/Building";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../../../../application/store/useGameStore");

describe("BuildingPalette", () => {
  const defaultResources: Resources = {
    power: 100,
    water: 100,
    biomass: 100,
    o2: 100,
    minerals: 100,
  };

  const defaultPlaced: PlacedBuilding[] = [
    { id: "hab-1", definitionId: "hab", position: { x: 0, y: 0, z: 0 }, condition: 100 },
  ];

  function mockStore(unlockedTechs: string[] = [TECH_IDS.BASIC_STRUCTURES]) {
    const fakeState: Partial<GameState> = {
      unlockedTechs,
    };
    vi.mocked(useGameStore).mockImplementation(
      (selector: (state: GameState) => unknown) => selector(fakeState as GameState)
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders building buttons without disabled attribute", () => {
    mockStore([TECH_IDS.BASIC_STRUCTURES]);
    render(
      <BuildingPalette
        resources={defaultResources}
        placedBuildings={defaultPlaced}
        selectedBuildingId={null}
        demolishActive={false}
        onSelect={vi.fn()}
      />
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
    // Ensure none of the palette buttons are HTML disabled so they remain clickable
    buttons.forEach((btn) => {
      expect(btn.hasAttribute("disabled")).toBe(false);
    });
  });

  it("calls onSelect when clicking an affordable, unlocked building whose dependencies are met", () => {
    mockStore([TECH_IDS.BASIC_STRUCTURES]);
    const onSelect = vi.fn();
    render(
      <BuildingPalette
        resources={defaultResources}
        placedBuildings={defaultPlaced}
        selectedBuildingId={null}
        demolishActive={false}
        onSelect={onSelect}
      />
    );

    // Click 'Centrum Kolonii' (hab) or 'Generator Solarny' (solar)
    const habBtn = screen.getByText("Centrum Kolonii").closest("button")!;
    fireEvent.click(habBtn);
    expect(onSelect).toHaveBeenCalledWith("hab");
  });

  it("calls onOpenResearch with requiredTech when clicking a tech-locked building", () => {
    // only basic_structures unlocked; o2-gen requires o2_synthesis
    mockStore([TECH_IDS.BASIC_STRUCTURES]);
    const onOpenResearch = vi.fn();
    render(
      <BuildingPalette
        resources={defaultResources}
        placedBuildings={defaultPlaced}
        selectedBuildingId={null}
        demolishActive={false}
        onSelect={vi.fn()}
        onOpenResearch={onOpenResearch}
      />
    );

    const o2GenBtn = screen.getByText("Generator Tlenu").closest("button")!;
    fireEvent.click(o2GenBtn);
    expect(onOpenResearch).toHaveBeenCalledWith("o2_synthesis");
  });

  it("calls onOpenDependencies when tech is unlocked but dependency building is missing", () => {
    // unlock nuclear_power; RTG depends on 'solar', but placedBuildings only has 'hab'
    mockStore([TECH_IDS.BASIC_STRUCTURES, TECH_IDS.SOLAR_ARRAY, TECH_IDS.NUCLEAR_POWER]);
    const onOpenDependencies = vi.fn();
    const onSelect = vi.fn();
    render(
      <BuildingPalette
        resources={defaultResources}
        placedBuildings={defaultPlaced} // only 'hab', missing 'solar'
        selectedBuildingId={null}
        demolishActive={false}
        onSelect={onSelect}
        onOpenDependencies={onOpenDependencies}
      />
    );

    const rtgBtn = screen.getByText("Blok RTG").closest("button")!;
    fireEvent.click(rtgBtn);
    expect(onOpenDependencies).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("calls onResourceShortage with missing resource keys when player cannot afford building", () => {
    mockStore([TECH_IDS.BASIC_STRUCTURES]);
    const onResourceShortage = vi.fn();
    const onSelect = vi.fn();
    // 'hab' cost: { minerals: 40 }; player has 0 minerals
    const emptyResources: Resources = {
      power: 0,
      water: 0,
      biomass: 0,
      o2: 0,
      minerals: 0,
    };

    render(
      <BuildingPalette
        resources={emptyResources}
        placedBuildings={defaultPlaced}
        selectedBuildingId={null}
        demolishActive={false}
        onSelect={onSelect}
        onResourceShortage={onResourceShortage}
      />
    );

    const habBtn = screen.getByText("Centrum Kolonii").closest("button")!;
    fireEvent.click(habBtn);
    expect(onResourceShortage).toHaveBeenCalled();
    const missingKeys = onResourceShortage.mock.calls[0][0];
    expect(missingKeys).toContain("minerals");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("does not trigger onSelect or callbacks when demolishActive is true", () => {
    mockStore([TECH_IDS.BASIC_STRUCTURES]);
    const onSelect = vi.fn();
    const onOpenResearch = vi.fn();
    render(
      <BuildingPalette
        resources={defaultResources}
        placedBuildings={defaultPlaced}
        selectedBuildingId={null}
        demolishActive={true}
        onSelect={onSelect}
        onOpenResearch={onOpenResearch}
      />
    );

    const habBtn = screen.getByText("Centrum Kolonii").closest("button")!;
    fireEvent.click(habBtn);
    expect(onSelect).not.toHaveBeenCalled();
    expect(onOpenResearch).not.toHaveBeenCalled();
  });
});
