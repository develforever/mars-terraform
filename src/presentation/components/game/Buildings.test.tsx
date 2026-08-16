import { render, screen } from "@testing-library/react";
import { it, expect, vi } from "vitest";
import { BuildingInspectionPopover } from "./Buildings";
import type { PlacedBuilding } from "../../../domain/entities/Building";

// Mock @react-three/drei's Html component to just render its children
vi.mock("@react-three/drei", () => ({
  Html: ({ children }: { children?: React.ReactNode }) => <div data-testid="mock-html">{children}</div>,
}));

it("should render building production with correct sign formatting", () => {
  const building: PlacedBuilding = {
    id: "test-hab",
    definitionId: "hab",
    position: { x: 0, y: 0, z: 0 },
    condition: 100,
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
