import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OffscreenThreatRadar } from "../OffscreenThreatRadar";
import { useUIStore, type OffscreenThreatItem } from "../../../../application/store/useUIStore";

// Mock i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "hud.threatRadar.incoming": "Wykryto zagrożenie!",
        "hud.threatRadar.alienShip": "Statek Obcych",
        "hud.threatRadar.alienGround": "Obcy Naziemny",
        "hud.threatRadar.meteor": "Uderzenie Meteorytu",
        "hud.threatRadar.clickToFocus": "Kliknij, aby wycentrować kamerę",
      };
      return map[key] || key;
    },
  }),
}));

describe("OffscreenThreatRadar", () => {
  beforeEach(() => {
    useUIStore.getState().resetUI();
    useUIStore.getState().setOffscreenThreats([]);
  });

  it("renders nothing when there are no offscreen threats", () => {
    const { container } = render(<OffscreenThreatRadar />);
    expect(container.firstChild).toBeNull();
  });

  it("renders directional indicator badges for detected offscreen threats", () => {
    const threats: OffscreenThreatItem[] = [
      {
        id: "ship-1",
        type: "alien_ship",
        worldPosition: { x: 45, y: 10, z: -30 },
        screenX: 950,
        screenY: 50,
        angleRad: -0.5,
        distanceMeters: 142,
        severity: "critical",
      },
      {
        id: "meteor-1",
        type: "meteor",
        worldPosition: { x: -40, y: 0, z: 25 },
        screenX: 40,
        screenY: 400,
        angleRad: 2.1,
        distanceMeters: 85,
        severity: "warning",
      },
    ];

    useUIStore.getState().setOffscreenThreats(threats);

    render(<OffscreenThreatRadar />);

    expect(screen.getByText("142m")).toBeInTheDocument();
    expect(screen.getByText("85m")).toBeInTheDocument();
    expect(screen.getByText("🛸")).toBeInTheDocument();
    expect(screen.getByText("☄️")).toBeInTheDocument();
  });

  it("requests camera pan to threat position when indicator is clicked", () => {
    const threat: OffscreenThreatItem = {
      id: "alien-ground-1",
      type: "alien_ground",
      worldPosition: { x: -35, y: 1.2, z: 28 },
      screenX: 50,
      screenY: 500,
      angleRad: 2.5,
      distanceMeters: 98,
      severity: "danger",
    };

    useUIStore.getState().setOffscreenThreats([threat]);

    render(<OffscreenThreatRadar />);

    const badge = screen.getByText("98m").closest("button");
    expect(badge).toBeInTheDocument();

    fireEvent.click(badge!);

    const panRequest = useUIStore.getState().cameraPanRequest;
    expect(panRequest).toEqual({ x: -35, z: 28 });
  });
});
