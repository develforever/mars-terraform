import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TacticalMinimap } from "../TacticalMinimap";
import { useUIStore } from "../../../../application/store/useUIStore";
import { useGameStore } from "../../../../application/store/useGameStore";

// Mock i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "hud.minimap": "Mini-mapa",
        "hud.minimapCollapse": "Zwiń mini-mapę",
        "hud.minimapExpand": "Rozwiń mini-mapę",
        "hud.minimapClose": "Zamknij mini-mapę",
        "hud.minimapDefense": "Obrona",
        "hud.minimapProduction": "Produkcja",
        "hud.minimapUnits": "Jednostki",
      };
      return map[key] || key;
    },
  }),
}));

// Mock HTMLCanvasElement.prototype.getContext for 2D canvas testing
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  strokeRect: vi.fn(),
  setLineDash: vi.fn(),
})) as unknown as typeof HTMLCanvasElement.prototype.getContext;

describe("TacticalMinimap", () => {
  beforeEach(() => {
    useUIStore.getState().resetUI();
    useUIStore.getState().setMinimapVisible(true);
    useUIStore.getState().setMinimapExpanded(true);
    useGameStore.getState().resetGame();
  });

  it("renders minimap panel with canvas when visible and expanded", () => {
    render(<TacticalMinimap />);

    expect(screen.getByRole("complementary", { name: /tactical minimap/i })).toBeInTheDocument();
    expect(screen.getByText(/Mini-mapa/i)).toBeInTheDocument();
    const canvas = document.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
    expect(canvas?.getAttribute("width")).toBe("220");
    expect(canvas?.getAttribute("height")).toBe("160");
  });

  it("does not render when isMinimapVisible is false", () => {
    useUIStore.getState().setMinimapVisible(false);
    const { container } = render(<TacticalMinimap />);
    expect(container.firstChild).toBeNull();
  });

  it("toggles collapse state when expand/collapse button is clicked", () => {
    render(<TacticalMinimap />);

    const toggleBtn = screen.getByTitle("Zwiń mini-mapę");
    expect(toggleBtn).toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(useUIStore.getState().isMinimapExpanded).toBe(false);

    // Canvas should not be rendered when collapsed
    expect(document.querySelector("canvas")).toBeNull();
  });

  it("closes minimap when close button is clicked", () => {
    render(<TacticalMinimap />);

    const closeBtn = screen.getByTitle("Zamknij mini-mapę");
    expect(closeBtn).toBeInTheDocument();

    fireEvent.click(closeBtn);
    expect(useUIStore.getState().isMinimapVisible).toBe(false);
  });

  it("requests camera pan when canvas is clicked", () => {
    render(<TacticalMinimap />);

    const canvas = document.querySelector("canvas");
    expect(canvas).toBeInTheDocument();

    // Mock getBoundingClientRect
    vi.spyOn(canvas!, "getBoundingClientRect").mockReturnValue({
      left: 100,
      top: 100,
      width: 220,
      height: 160,
      right: 320,
      bottom: 260,
      x: 100,
      y: 100,
      toJSON: () => {},
    });

    // Click in center of minimap (110, 80) -> relative to bounding rect (210, 180)
    fireEvent.pointerDown(canvas!, { clientX: 210, clientY: 180, pointerId: 1 });

    const panRequest = useUIStore.getState().cameraPanRequest;
    expect(panRequest).toBeDefined();
    expect(panRequest?.x).toBeCloseTo(0, 0);
    expect(panRequest?.z).toBeCloseTo(0, 0);
  });
});
