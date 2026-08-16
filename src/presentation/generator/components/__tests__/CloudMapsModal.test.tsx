import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CloudMapsModal } from "../CloudMapsModal";
import { authClient } from "../../../../application/service/authService";
import { mapApiService } from "../../../../application/service/mapApiService";
import { useMapEditorStore } from "../../../../application/store/useMapEditorStore";

describe("CloudMapsModal", () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders unauthenticated message when user is not logged in", () => {
    vi.spyOn(authClient, "isAuthenticated").mockReturnValue(false);

    render(<CloudMapsModal onClose={mockOnClose} />);

    expect(screen.getByText("Wymagane zalogowanie")).toBeInTheDocument();
    expect(
      screen.getByText("Musisz być zalogowany, aby przeglądać i pobierać swoje mapy z chmury.")
    ).toBeInTheDocument();
  });

  it("renders empty state when user is logged in but has no maps", async () => {
    vi.spyOn(authClient, "isAuthenticated").mockReturnValue(true);
    vi.spyOn(mapApiService, "listMaps").mockResolvedValue([]);

    render(<CloudMapsModal onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText("Brak zapisanych map")).toBeInTheDocument();
    });
  });

  it("renders list of saved maps when user is logged in", async () => {
    vi.spyOn(authClient, "isAuthenticated").mockReturnValue(true);
    vi.spyOn(mapApiService, "listMaps").mockResolvedValue([
      {
        id: 101,
        userId: 1,
        name: "Olympus Mons Pass",
        description: "Strategic mountain pass",
        players: 2,
        version: "2.0",
        createdAt: "2026-08-16T12:00:00.000Z",
        updatedAt: "2026-08-16T12:00:00.000Z",
      },
    ]);

    render(<CloudMapsModal onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText("Olympus Mons Pass")).toBeInTheDocument();
      expect(screen.getByText("Strategic mountain pass")).toBeInTheDocument();
      expect(screen.getByText("👥 2 graczy")).toBeInTheDocument();
    });
  });

  it("loads map into store when Load button is clicked", async () => {
    vi.spyOn(authClient, "isAuthenticated").mockReturnValue(true);
    vi.spyOn(mapApiService, "listMaps").mockResolvedValue([
      {
        id: 101,
        userId: 1,
        name: "Olympus Mons Pass",
        description: "Strategic mountain pass",
        players: 2,
        version: "2.0",
        createdAt: "2026-08-16T12:00:00.000Z",
        updatedAt: "2026-08-16T12:00:00.000Z",
      },
    ]);

    const mockExportMapData = {
      meta: {
        name: "Olympus Mons Pass",
        description: "Strategic mountain pass",
        version: "2.0",
        gridType: "hex-flat-top",
        hexSize: 1,
        hexRadius: 20,
        players: 2,
        seed: 42,
      },
      hexes: [],
      buildNodes: [],
      resourceNodes: [],
      spawnPoints: [],
      decor: [],
    };

    vi.spyOn(mapApiService, "getMap").mockResolvedValue({
      id: 101,
      userId: 1,
      name: "Olympus Mons Pass",
      description: "Strategic mountain pass",
      players: 2,
      version: "2.0",
      data: JSON.stringify(mockExportMapData),
      createdAt: "2026-08-16T12:00:00.000Z",
      updatedAt: "2026-08-16T12:00:00.000Z",
    });

    const loadFromJSONSpy = vi.spyOn(useMapEditorStore.getState(), "loadFromJSON");

    render(<CloudMapsModal onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText("Olympus Mons Pass")).toBeInTheDocument();
    });

    const loadBtn = screen.getByRole("button", { name: "Load" });
    fireEvent.click(loadBtn);

    await waitFor(() => {
      expect(mapApiService.getMap).toHaveBeenCalledWith(101);
      expect(loadFromJSONSpy).toHaveBeenCalledWith(mockExportMapData);
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it("deletes map after confirmation when Delete button is clicked", async () => {
    vi.spyOn(authClient, "isAuthenticated").mockReturnValue(true);
    vi.spyOn(mapApiService, "listMaps").mockResolvedValue([
      {
        id: 101,
        userId: 1,
        name: "Map To Delete",
        description: null,
        players: 2,
        version: "2.0",
        createdAt: null,
        updatedAt: null,
      },
    ]);
    vi.spyOn(mapApiService, "deleteMap").mockResolvedValue({ message: "Deleted" });

    render(<CloudMapsModal onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText("Map To Delete")).toBeInTheDocument();
    });

    const deleteBtn = screen.getByRole("button", { name: "Delete" });
    fireEvent.click(deleteBtn);

    expect(screen.getByText("Czy na pewno usunąć tę mapę z chmury?")).toBeInTheDocument();

    const confirmDeleteBtn = screen.getByRole("button", { name: "Tak, usuń" });
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(mapApiService.deleteMap).toHaveBeenCalledWith(101);
      expect(screen.queryByText("Map To Delete")).not.toBeInTheDocument();
    });
  });

  it("calls onClose when Close button is clicked", () => {
    vi.spyOn(authClient, "isAuthenticated").mockReturnValue(false);

    render(<CloudMapsModal onClose={mockOnClose} />);

    const closeBtn = screen.getByRole("button", { name: "Close" });
    fireEvent.click(closeBtn);

    expect(mockOnClose).toHaveBeenCalled();
  });
});
