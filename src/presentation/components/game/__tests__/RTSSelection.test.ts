import { describe, it, expect, beforeEach } from "vitest";
import { useUIStore } from "../../../../application/store/useUIStore";
import { useGameStore } from "../../../../application/store/useGameStore";

describe("RTSSelection and Control Groups", () => {
  beforeEach(() => {
    useUIStore.getState().resetUI();
    useGameStore.getState().resetGame();
  });

  it("selects and clears unit selection in UIStore", () => {
    useUIStore.getState().selectUnits(["unit-1", "unit-2"]);
    expect(useUIStore.getState().selectedUnitIds).toEqual(["unit-1", "unit-2"]);

    useUIStore.getState().toggleSelectUnit("unit-3");
    expect(useUIStore.getState().selectedUnitIds).toEqual(["unit-1", "unit-2", "unit-3"]);

    useUIStore.getState().toggleSelectUnit("unit-1");
    expect(useUIStore.getState().selectedUnitIds).toEqual(["unit-2", "unit-3"]);

    useUIStore.getState().clearUnitSelection();
    expect(useUIStore.getState().selectedUnitIds).toEqual([]);
  });

  it("manages control groups correctly", () => {
    useUIStore.getState().setControlGroup(1, ["unit-a", "unit-b"]);
    useUIStore.getState().setControlGroup(2, ["unit-c"]);

    expect(useUIStore.getState().controlGroups[1]).toEqual(["unit-a", "unit-b"]);
    expect(useUIStore.getState().controlGroups[2]).toEqual(["unit-c"]);

    useUIStore.getState().selectControlGroup(1);
    expect(useUIStore.getState().selectedUnitIds).toEqual(["unit-a", "unit-b"]);

    useUIStore.getState().selectControlGroup(2);
    expect(useUIStore.getState().selectedUnitIds).toEqual(["unit-c"]);
  });

  it("issues RTS orders to selected units in GameStore", () => {
    const units = useGameStore.getState().units;
    expect(units.length).toBeGreaterThan(0);
    const targetUnit = units[0];

    useUIStore.getState().selectUnits([targetUnit.id]);
    useGameStore.getState().issueOrderToUnits([targetUnit.id], {
      type: "MOVE",
      targetPosition: { x: 10, y: 0, z: 10 },
    });

    const updatedUnits = useGameStore.getState().units;
    const updatedTarget = updatedUnits.find((u) => u.id === targetUnit.id);
    expect(updatedTarget?.status).toBe("moving");
    expect(updatedTarget?.targetPosition).toEqual({ x: 10, y: 0, z: 10 });
  });
});
