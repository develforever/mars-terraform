import { render, screen } from "@testing-library/react";
import { it, expect, vi } from "vitest";
import { BuildingInspectionPopover } from "./Buildings";
import type { PlacedBuilding } from "../../../domain/entities/Building";

// Mock @react-three/drei's Html component to just render its children
vi.mock("@react-three/drei", () => ({
  Html: ({ children }: { children?: React.ReactNode }) => <div data-testid="mock-html">{children}</div>,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { level?: number }) => {
      if (key === "popover.levelBadge") return `POZ. ${options?.level ?? 1}`;
      if (key === "popover.upgradeTo") return `Ulepsz do Poz. ${options?.level ?? 2}`;
      if (key === "popover.maxLevel") return `Maksymalny poziom (POZ. ${options?.level ?? 3})`;
      return key;
    },
  }),
}));

it("should render building production with correct sign formatting", () => {
  const building: PlacedBuilding = {
    id: "test-hab",
    definitionId: "hab",
    position: { x: 0, y: 0, z: 0 },
    condition: 100,
    level: 1,
  };

  render(<BuildingInspectionPopover building={building} />);

  // The Colony Center (hab) has:
  // production: { o2: 0.15, power: -0.10, water: -0.05 }
  // O2 should be formatted as "+0.15"
  // Power should be formatted as "-0.1" (not "+-0.1")
  // Water should be formatted as "-0.05" (not "+-0.05")

  // Check the title
  expect(screen.getByText("Centrum Kolonii")).toBeTruthy();

  // Check the condition
  expect(screen.getByText("100%")).toBeTruthy();

  // Check level badge
  expect(screen.getByText("POZ. 1")).toBeTruthy();

  // Check O2 production (positive value)
  const o2Val = screen.getByText("+0.15");
  expect(o2Val).toBeTruthy();

  // Check Power production (negative value)
  const powerVal = screen.getByText("-0.1");
  expect(powerVal).toBeTruthy();
  expect(screen.queryByText("+-0.1")).toBeNull();

  // Check Water production (negative value)
  const waterVal = screen.getByText("-0.05");
  expect(waterVal).toBeTruthy();
  expect(screen.queryByText("+-0.05")).toBeNull();
});

it("should render upgrade options and max level state", () => {
  const buildingLvl1: PlacedBuilding = {
    id: "test-miner-1",
    definitionId: "miner",
    position: { x: 0, y: 0, z: 0 },
    condition: 100,
    level: 1,
  };

  const { rerender } = render(<BuildingInspectionPopover building={buildingLvl1} />);

  // Lvl 1 should show upgrade preview for Poz 2
  expect(screen.getByText("POZ. 1")).toBeTruthy();
  expect(screen.getByText("Ulepsz do Poz. 2")).toBeTruthy();
  expect(screen.getByText("x1.5")).toBeTruthy();

  // Re-render as max level (Lvl 3)
  const buildingLvl3: PlacedBuilding = { ...buildingLvl1, level: 3 };
  rerender(<BuildingInspectionPopover building={buildingLvl3} />);
  expect(screen.getByText("POZ. 3")).toBeTruthy();
  expect(screen.getByText("Maksymalny poziom (POZ. 3)")).toBeTruthy();
});

