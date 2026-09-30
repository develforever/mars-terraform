import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CloudMapsModal } from "../CloudMapsModal";
import { mapLibraryService } from "../../../../application/service/mapLibraryService";
import { useMapEditorStore } from "../../../../application/store/useMapEditorStore";

describe("CloudMapsModal", () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("T14: informuje, że mapy są tylko w tej przeglądarce", async () => {
    vi.spyOn(mapLibraryService, "listMaps").mockResolvedValue([]);
    render(<CloudMapsModal onClose={mockOnClose} />);
    expect(screen.getByText(/Nie trafiają na żaden serwer/)).toBeInTheDocument();
    await waitFor(() => expect(mapLibraryService.listMaps).toHaveBeenCalledTimes(1));
  });

  it("renders empty state when there are no maps", async () => {
    vi.spyOn(mapLibraryService, "listMaps").mockResolvedValue([]);

    render(<CloudMapsModal onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText("Brak zapisanych map")).toBeInTheDocument();
    });
  });

  it("renders list of saved maps", async () => {
    vi.spyOn(mapLibraryService, "listMaps").mockResolvedValue([
      {
        id: 101,
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
    vi.spyOn(mapLibraryService, "listMaps").mockResolvedValue([
      {
        id: 101,
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

    vi.spyOn(mapLibraryService, "getMap").mockResolvedValue({
      id: 101,
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
      expect(mapLibraryService.getMap).toHaveBeenCalledWith(101);
      expect(loadFromJSONSpy).toHaveBeenCalledWith(mockExportMapData);
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it("deletes map after confirmation when Delete button is clicked", async () => {
    vi.spyOn(mapLibraryService, "listMaps").mockResolvedValue([
      {
        id: 101,
        name: "Map To Delete",
        description: null,
        players: 2,
        version: "2.0",
        createdAt: "2026-09-30T00:00:00Z",
        updatedAt: "2026-09-30T00:00:00Z",
      },
    ]);
    vi.spyOn(mapLibraryService, "deleteMap").mockResolvedValue({ message: "Deleted" });

    render(<CloudMapsModal onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText("Map To Delete")).toBeInTheDocument();
    });

    const deleteBtn = screen.getByRole("button", { name: "Delete" });
    fireEvent.click(deleteBtn);

    expect(screen.getByText("Czy na pewno usunąć tę mapę z biblioteki?")).toBeInTheDocument();

    const confirmDeleteBtn = screen.getByRole("button", { name: "Tak, usuń" });
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(mapLibraryService.deleteMap).toHaveBeenCalledWith(101);
      expect(screen.queryByText("Map To Delete")).not.toBeInTheDocument();
    });
  });

  it("calls onClose when Close button is clicked", () => {
    vi.spyOn(mapLibraryService, "listMaps").mockResolvedValue([]);

    render(<CloudMapsModal onClose={mockOnClose} />);

    const closeBtn = screen.getByRole("button", { name: "Close" });
    fireEvent.click(closeBtn);

    expect(mockOnClose).toHaveBeenCalled();
  });
});
