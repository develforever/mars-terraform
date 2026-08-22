import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ColonyNameModal } from "../ColonyNameModal";
import { mapApiService } from "../../../../application/service/mapApiService";
import { useGameStore } from "../../../../application/store/useGameStore";
import type { MapExportJSON } from "../../../../domain/mapEditorTypes";

vi.mock("react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../../../../application/service/mapApiService", () => ({
  mapApiService: {
    listMaps: vi.fn(),
    getMap: vi.fn(),
  },
}));

vi.mock("../../../../application/service/authService", () => ({
  authClient: {
    getToken: vi.fn().mockReturnValue("mock-token"),
    isAuthenticated: vi.fn().mockReturnValue(true),
  },
}));

const mockMapData: MapExportJSON = {
  meta: {
    name: "Red Crater Beta",
    description: "Sample Cloud Map",
    version: "2.0",
    gridType: "hex-flat-top",
    hexSize: 1,
    hexRadius: 12,
    players: 2,
    seed: 42,
  },
  hexes: [{ q: 0, r: 0, terrainType: "plains", userType: null, decor: null }],
  buildNodes: [],
  resourceNodes: [],
  spawnPoints: [],
  decor: [],
};

describe("ColonyNameModal", () => {
  const mockOnConfirm = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useGameStore.getState().resetGame();
  });

  it("renders modal elements and default procedural map selection", async () => {
    render(<ColonyNameModal onConfirm={mockOnConfirm} onCancel={mockOnCancel} />);

    await waitFor(() => {
      expect(screen.getByText("modal.colony.title")).toBeInTheDocument();
    });
    expect(screen.getByText("Procedural Mars")).toBeInTheDocument();
    expect(screen.getByText("Cloud Maps")).toBeInTheDocument();
  });

  it("fetches and renders cloud maps when Cloud Maps source is selected", async () => {
    vi.mocked(mapApiService.listMaps).mockResolvedValue([
      {
        id: 101,
        userId: 1,
        name: "Cloud Map One",
        description: "Description 1",
        players: 2,
        version: "2.0",
        createdAt: null,
        updatedAt: null,
      },
    ]);

    render(<ColonyNameModal onConfirm={mockOnConfirm} onCancel={mockOnCancel} />);

    const cloudBtn = screen.getByText("Cloud Maps");
    fireEvent.click(cloudBtn);

    await waitFor(() => {
      expect(mapApiService.listMaps).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole("combobox", { name: /wybierz mapę z chmury/i })).toBeInTheDocument();
    expect(screen.getByText("Cloud Map One (2 graczy)")).toBeInTheDocument();
  });

  it("loads selected cloud map details and shows badge", async () => {
    vi.mocked(mapApiService.listMaps).mockResolvedValue([
      {
        id: 101,
        userId: 1,
        name: "Cloud Map One",
        description: "Description 1",
        players: 2,
        version: "2.0",
        createdAt: null,
        updatedAt: null,
      },
    ]);
    vi.mocked(mapApiService.getMap).mockResolvedValue({
      id: 101,
      userId: 1,
      name: "Cloud Map One",
      description: "Description 1",
      players: 2,
      version: "2.0",
      createdAt: null,
      updatedAt: null,
      data: JSON.stringify(mockMapData),
    });

    render(<ColonyNameModal onConfirm={mockOnConfirm} onCancel={mockOnCancel} />);

    fireEvent.click(screen.getByText("Cloud Maps"));

    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: /wybierz mapę z chmury/i })).toBeInTheDocument();
    });

    const select = screen.getByRole("combobox", { name: /wybierz mapę z chmury/i });
    fireEvent.change(select, { target: { value: "101" } });

    await waitFor(() => {
      expect(mapApiService.getMap).toHaveBeenCalledWith(101);
    });

    expect(screen.getByText("📍 Red Crater Beta")).toBeInTheDocument();
    expect(screen.getByText("👥 2 graczy")).toBeInTheDocument();
  });

  it("calls startNewGame with null mapData and procedural seed when procedural map is selected", async () => {
    const startNewGameSpy = vi.spyOn(useGameStore.getState(), "startNewGame");

    render(<ColonyNameModal onConfirm={mockOnConfirm} onCancel={mockOnCancel} />);

    const input = screen.getByPlaceholderText("modal.colony.placeholder");
    fireEvent.change(input, { target: { value: "Alpha Colony" } });

    const seedInput = screen.getByLabelText(/seed:/i);
    fireEvent.change(seedInput, { target: { value: "777" } });

    const confirmBtn = screen.getByText("modal.colony.start");
    fireEvent.click(confirmBtn);

    expect(startNewGameSpy).toHaveBeenCalledWith("Alpha Colony", "normal", "exploration", null, 777);
    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
  });
});

