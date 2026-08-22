import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import GeneratorToolbar from "../GeneratorToolbar";
import { authClient } from "../../../../application/service/authService";

describe("GeneratorToolbar - Cloud Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubGlobal("alert", vi.fn());
  });

  it("renders Save Cloud and Cloud buttons", () => {
    render(<GeneratorToolbar />);

    expect(screen.getByRole("button", { name: /Save Cloud/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^☁ Cloud$/i })).toBeInTheDocument();
  });

  it("alerts user when Save Cloud is clicked while unauthenticated", () => {
    vi.spyOn(authClient, "isAuthenticated").mockReturnValue(false);

    render(<GeneratorToolbar />);

    const saveCloudBtn = screen.getByRole("button", { name: /Save Cloud/i });
    fireEvent.click(saveCloudBtn);

    expect(window.alert).toHaveBeenCalledWith("Musisz być zalogowany, aby zapisać mapę w chmurze.");
  });

  it("opens CloudMapsModal when Cloud button is clicked", () => {
    render(<GeneratorToolbar />);

    const cloudBtn = screen.getByRole("button", { name: /^☁ Cloud$/i });
    fireEvent.click(cloudBtn);

    expect(screen.getByText("Cloud Maps Browser")).toBeInTheDocument();
  });

  it("opens AIAssistantModal when AI Assistant button is clicked", () => {
    render(<GeneratorToolbar />);

    const aiBtn = screen.getByRole("button", { name: /AI Assistant/i });
    fireEvent.click(aiBtn);

    expect(screen.getByText("modal.aiAssistant.title")).toBeInTheDocument();
  });
});
