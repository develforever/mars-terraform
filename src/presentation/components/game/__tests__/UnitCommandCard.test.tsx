import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UnitCommandCard } from "../UnitCommandCard";
import { useUIStore } from "../../../../application/store/useUIStore";
import { useGameStore } from "../../../../application/store/useGameStore";
import { UNIT_IDS } from "../../../../domain/config/units";

// Mock i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === "units.selectedUnits") return "Zaznaczone jednostki";
      if (key === "units.roles.combat") return "Bojowa";
      if (key === "units.roles.repair") return "Naprawcza";
      if (key === "units.roles.logistics") return "Logistyczna";
      if (key === "units.status.idle") return "Bezczynny";
      if (key === "units.orders.stop") return "Zatrzymaj";
      if (key === "units.orders.attack") return "Atakuj";
      if (key === "units.orders.repair") return "Napraw";
      return key;
    },
  }),
}));

describe("UnitCommandCard", () => {
  beforeEach(() => {
    useUIStore.getState().resetUI();
    useGameStore.getState().resetGame();
  });

  it("renders nothing when no unit is selected", () => {
    const { container } = render(<UnitCommandCard />);
    expect(container.firstChild).toBeNull();
  });

  it("renders single unit command card with stats and action buttons", () => {
    const units = useGameStore.getState().units;
    const combatRover = units.find((u) => u.definitionId === UNIT_IDS.ROVER_COMBAT);
    expect(combatRover).toBeDefined();

    useUIStore.getState().selectUnits([combatRover!.id]);

    render(<UnitCommandCard />);

    expect(screen.getByTestId("unit-command-card")).toBeInTheDocument();
    expect(screen.getByText("Bojowa")).toBeInTheDocument();
    expect(screen.getByText(/Zatrzymaj/i)).toBeInTheDocument();
    expect(screen.getByText(/Atakuj/i)).toBeInTheDocument();
    expect(screen.getByText(/Napraw/i)).toBeInTheDocument();
  });

  it("clears selection when close button is clicked", () => {
    const units = useGameStore.getState().units;
    useUIStore.getState().selectUnits([units[0].id]);

    render(<UnitCommandCard />);

    const closeBtn = screen.getByLabelText("Close");
    fireEvent.click(closeBtn);

    expect(useUIStore.getState().selectedUnitIds).toEqual([]);
  });

  it("issues STOP order when Stop button is clicked", () => {
    const units = useGameStore.getState().units;
    const unitId = units[0].id;
    useUIStore.getState().selectUnits([unitId]);

    // Move unit first
    useGameStore.getState().issueOrderToUnits([unitId], {
      type: "MOVE",
      targetPosition: { x: 5, y: 0, z: 5 },
    });
    expect(useGameStore.getState().units.find((u) => u.id === unitId)?.status).toBe("moving");

    render(<UnitCommandCard />);

    const stopBtn = screen.getByText(/Zatrzymaj/i).closest("button");
    expect(stopBtn).toBeInTheDocument();
    fireEvent.click(stopBtn!);

    expect(useGameStore.getState().units.find((u) => u.id === unitId)?.status).toBe("idle");
  });

  it("renders multi-unit view when multiple units are selected", () => {
    const units = useGameStore.getState().units;
    expect(units.length).toBeGreaterThanOrEqual(2);

    useUIStore.getState().selectUnits([units[0].id, units[1].id]);

    render(<UnitCommandCard />);

    expect(screen.getByText(/Zaznaczone jednostki \(2\)/i)).toBeInTheDocument();
  });
});
