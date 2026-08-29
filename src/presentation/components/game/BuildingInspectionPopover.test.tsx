import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BuildingInspectionPopover } from "./BuildingInspectionPopover";
import type { PlacedBuilding } from "../../../domain/entities/Building";
import { useGameStore } from "../../../application/store/useGameStore";
import { useUIStore } from "../../../application/store/useUIStore";

// Mock @react-three/drei's Html component
vi.mock("@react-three/drei", () => ({
  Html: ({ children }: { children?: React.ReactNode }) => <div data-testid="mock-html">{children}</div>,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { level?: number; count?: number; type?: string; bonus?: number }) => {
      if (key === "popover.levelBadge") return `POZ. ${options?.level ?? 1}`;
      if (key === "popover.upgradeTo") return `Ulepsz do Poz. ${options?.level ?? 2}`;
      if (key === "popover.maxLevel") return `Maksymalny poziom (POZ. ${options?.level ?? 3})`;
      if (key === "popover.powerActive") return "Aktywne (Online)";
      if (key === "popover.powerDisabled") return "Wyłączone (Offline)";
      if (key === "popover.powerNotice") return "Zasilanie wyłączone — wstrzymano produkcję i pobór surowców.";
      if (key === "popover.demolish") return "Wyburz budynek";
      if (key === "popover.demolishConfirmMsg") return "Czy na pewno chcesz wyburzyć ten obiekt?";
      if (key === "popover.demolishYes") return "Tak, wyburz";
      if (key === "popover.demolishCancel") return "Anuluj";
      if (key === "popover.close") return "Zamknij";
      return key;
    },
  }),
}));

describe("BuildingInspectionPopover", () => {
  beforeEach(() => {
    useUIStore.getState().resetUI();
    useGameStore.setState({
      resources: { power: 100, water: 100, biomass: 100, o2: 100, minerals: 100 },
      placed: [
        {
          id: "hab-1",
          definitionId: "hab",
          position: { x: 0, y: 0, z: 0 },
          condition: 100,
          level: 1,
        },
      ],
    });
  });

  it("renders building info, condition, level, and production values correctly", () => {
    const building: PlacedBuilding = {
      id: "hab-1",
      definitionId: "hab",
      position: { x: 0, y: 0, z: 0 },
      condition: 100,
      level: 1,
    };

    render(<BuildingInspectionPopover building={building} />);

    expect(screen.getByText("Centrum Kolonii")).toBeTruthy();
    expect(screen.getByText("100%")).toBeTruthy();
    expect(screen.getByText("POZ. 1")).toBeTruthy();
    expect(screen.getByText("+0.15")).toBeTruthy();
    expect(screen.getByText("-0.1")).toBeTruthy();
    expect(screen.getByText("-0.05")).toBeTruthy();
  });

  it("toggles building power state on button click", () => {
    const building: PlacedBuilding = {
      id: "hab-1",
      definitionId: "hab",
      position: { x: 0, y: 0, z: 0 },
      condition: 100,
      level: 1,
    };

    render(<BuildingInspectionPopover building={building} />);

    expect(screen.getByText("Aktywne (Online)")).toBeTruthy();
    const toggleBtn = screen.getByText("Wyłącz");
    expect(toggleBtn).toBeTruthy();

    fireEvent.click(toggleBtn);

    const storeBuilding = useGameStore.getState().placed.find((b) => b.id === "hab-1");
    expect(storeBuilding?.disabled).toBe(true);
  });

  it("shows offline notice and hides production when disabled", () => {
    const building: PlacedBuilding = {
      id: "hab-1",
      definitionId: "hab",
      position: { x: 0, y: 0, z: 0 },
      condition: 100,
      level: 1,
      disabled: true,
    };

    render(<BuildingInspectionPopover building={building} />);

    expect(screen.getByText("Wyłączone (Offline)")).toBeTruthy();
    expect(
      screen.getByText("Zasilanie wyłączone — wstrzymano produkcję i pobór surowców.")
    ).toBeTruthy();
    expect(screen.getByText("Włącz")).toBeTruthy();
  });

  it("handles upgrade action when affordable", () => {
    const building: PlacedBuilding = {
      id: "hab-1",
      definitionId: "hab",
      position: { x: 0, y: 0, z: 0 },
      condition: 100,
      level: 1,
    };

    render(<BuildingInspectionPopover building={building} />);

    const upgradeBtn = screen.getByText("popover.upgrade");
    expect(upgradeBtn).toBeTruthy();
    expect(upgradeBtn.hasAttribute("disabled")).toBe(false);

    fireEvent.click(upgradeBtn);

    const updated = useGameStore.getState().placed.find((b) => b.id === "hab-1");
    expect(updated?.level).toBe(2);
  });

  it("handles demolish confirmation flow", () => {
    const building: PlacedBuilding = {
      id: "hab-1",
      definitionId: "hab",
      position: { x: 0, y: 0, z: 0 },
      condition: 100,
      level: 1,
    };

    useUIStore.getState().setInspectedInstance("hab-1");

    render(<BuildingInspectionPopover building={building} />);

    const demolishInitialBtn = screen.getByText("Wyburz budynek");
    fireEvent.click(demolishInitialBtn);

    expect(screen.getByText("Czy na pewno chcesz wyburzyć ten obiekt?")).toBeTruthy();

    const confirmBtn = screen.getByText("Tak, wyburz");
    fireEvent.click(confirmBtn);

    const remaining = useGameStore.getState().placed.find((b) => b.id === "hab-1");
    expect(remaining).toBeUndefined();
    expect(useUIStore.getState().inspectedInstanceId).toBeNull();
  });

  it("closes popover on close button click and Escape key", () => {
    const building: PlacedBuilding = {
      id: "hab-1",
      definitionId: "hab",
      position: { x: 0, y: 0, z: 0 },
      condition: 100,
      level: 1,
    };

    useUIStore.getState().setInspectedInstance("hab-1");

    render(<BuildingInspectionPopover building={building} />);

    const closeBtn = screen.getByRole("button", { name: "Zamknij" });
    fireEvent.click(closeBtn);
    expect(useUIStore.getState().inspectedInstanceId).toBeNull();

    useUIStore.getState().setInspectedInstance("hab-1");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(useUIStore.getState().inspectedInstanceId).toBeNull();
  });
});
