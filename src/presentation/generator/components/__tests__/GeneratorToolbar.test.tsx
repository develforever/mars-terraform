import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import GeneratorToolbar from "../GeneratorToolbar";
import { mapLibraryService } from "../../../../application/service/mapLibraryService";

describe("GeneratorToolbar - biblioteka map (T14)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubGlobal("alert", vi.fn());
  });

  it("renders library save and browse buttons", () => {
    render(<GeneratorToolbar />);

    expect(screen.getByRole("button", { name: /Zapisz w bibliotece/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^🗂 Biblioteka$/i })).toBeInTheDocument();
  });

  it("zapisuje mapę w bibliotece przeglądarki bez logowania", async () => {
    const saveSpy = vi.spyOn(mapLibraryService, "saveMap").mockResolvedValue({
      id: 1, name: "Test", description: null, players: 2, version: "2.0", data: "{}",
      createdAt: "2026-09-30T00:00:00Z", updatedAt: "2026-09-30T00:00:00Z",
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<GeneratorToolbar />);

    fireEvent.click(screen.getByRole("button", { name: /Zapisz w bibliotece/i }));

    expect(await screen.findByText(/zapisana w bibliotece tej przeglądarki/)).toBeInTheDocument();
    expect(saveSpy).toHaveBeenCalledTimes(1);
  });

  it("opens map library when Biblioteka button is clicked", () => {
    render(<GeneratorToolbar />);

    const cloudBtn = screen.getByRole("button", { name: /^🗂 Biblioteka$/i });
    fireEvent.click(cloudBtn);

    expect(screen.getByText(/Biblioteka map/)).toBeInTheDocument();
  });

  it("opens AIAssistantModal when AI Assistant button is clicked", () => {
    render(<GeneratorToolbar />);

    const aiBtn = screen.getByRole("button", { name: /AI Assistant/i });
    fireEvent.click(aiBtn);

    expect(screen.getByText("modal.aiAssistant.title")).toBeInTheDocument();
  });
});
