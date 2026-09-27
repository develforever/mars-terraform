import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router";
import i18n from "../../../app/i18n";
import AccountModal from "./AccountModal";
import { useAuthStore } from "../../../application/store/useAuthStore";
import { authClient } from "../../../application/service/authService";

const USER = {
  id: 7,
  name: "Marsjanin",
  email: "u7@mars.test",
  authProvider: "local",
  emailVerifiedAt: null,
  createdAt: null,
};

const renderModal = () =>
  render(
    <MemoryRouter>
      <AccountModal />
    </MemoryRouter>,
  );

describe("AccountModal (T12, RODO)", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pl");
    useAuthStore.setState({ user: USER, isAuthenticated: true, isLoading: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("przycisk usuwania jest nieaktywny, dopóki nie wpisano własnego e-maila", () => {
    renderModal();
    const button = screen.getByRole("button", { name: "Usuń konto na zawsze" }) as HTMLButtonElement;
    const input = screen.getByLabelText("Wpisz swój adres e-mail, aby potwierdzić");

    expect(button.disabled).toBe(true);
    fireEvent.change(input, { target: { value: "inny@mars.test" } });
    expect(button.disabled).toBe(true);
    fireEvent.change(input, { target: { value: " U7@Mars.Test " } });
    expect(button.disabled).toBe(false);
  });

  it("po potwierdzeniu usuwa konto i pokazuje komunikat", async () => {
    const deleteAccount = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({ deleteAccount });
    renderModal();

    fireEvent.change(screen.getByLabelText("Wpisz swój adres e-mail, aby potwierdzić"), { target: { value: USER.email } });
    fireEvent.click(screen.getByRole("button", { name: "Usuń konto na zawsze" }));

    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Konto i wszystkie dane zostały usunięte"));
    expect(deleteAccount).toHaveBeenCalledTimes(1);
  });

  it("pokazuje błąd, gdy usunięcie się nie powiedzie", async () => {
    useAuthStore.setState({ deleteAccount: vi.fn().mockRejectedValue(new Error("HTTP 500")) });
    renderModal();

    fireEvent.change(screen.getByLabelText("Wpisz swój adres e-mail, aby potwierdzić"), { target: { value: USER.email } });
    fireEvent.click(screen.getByRole("button", { name: "Usuń konto na zawsze" }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("HTTP 500"));
  });

  it("pobiera dane jako plik JSON", async () => {
    const blob = new Blob(["{}"], { type: "application/json" });
    const exportSpy = vi.spyOn(authClient, "exportMyData").mockResolvedValue(blob);
    const createObjectURL = vi.fn().mockReturnValue("blob:test");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL }));
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderModal();

    fireEvent.click(screen.getByRole("button", { name: "Pobierz dane (JSON)" }));

    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));
    expect(exportSpy).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test");
    vi.unstubAllGlobals();
  });
});
