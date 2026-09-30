import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router";
import i18n from "../../../app/i18n";
import AccountModal from "./AccountModal";
import { useAuthStore } from "../../../application/store/useAuthStore";
import { authClient, type User } from "../../../application/service/authService";

const USER: User = {
  id: 7,
  nickname: "Marsjanin",
  totpEnabled: false,
  createdAt: "2026-09-27T00:00:00Z",
  lastLoginAt: null,
};

const renderModal = () =>
  render(
    <MemoryRouter>
      <AccountModal />
    </MemoryRouter>,
  );

describe("AccountModal (T12/T13)", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pl");
    useAuthStore.setState({ user: USER, isAuthenticated: true, isLoading: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("pokazuje pseudonim, a bez pseudonimu numer konta w bazie (#id)", () => {
    const { unmount } = renderModal();
    expect(screen.getByText("Marsjanin")).toBeTruthy();
    unmount();
    useAuthStore.setState({ user: { ...USER, nickname: null } });
    renderModal();
    expect(screen.getByText("#7")).toBeTruthy();
  });

  it("usunięcie konta wymaga wpisania słowa USUŃ", async () => {
    const deleteAccount = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({ deleteAccount });
    renderModal();
    const button = screen.getByRole("button", { name: "Usuń konto na zawsze" }) as HTMLButtonElement;
    const input = screen.getByLabelText("Wpisz USUŃ, aby potwierdzić");

    expect(button.disabled).toBe(true);
    fireEvent.change(input, { target: { value: "usun" } });
    expect(button.disabled).toBe(true);
    fireEvent.change(input, { target: { value: " usuń " } });
    expect(button.disabled).toBe(false);
    fireEvent.click(button);

    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Konto i wszystkie dane zostały usunięte"));
    expect(deleteAccount).toHaveBeenCalledTimes(1);
  });

  it("pokazuje błąd, gdy usunięcie się nie powiedzie", async () => {
    useAuthStore.setState({ deleteAccount: vi.fn().mockRejectedValue(new Error("HTTP 500")) });
    renderModal();
    fireEvent.change(screen.getByLabelText("Wpisz USUŃ, aby potwierdzić"), { target: { value: "USUŃ" } });
    fireEvent.click(screen.getByRole("button", { name: "Usuń konto na zawsze" }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("HTTP 500"));
  });

  it("zapisuje pseudonim i aktualizuje użytkownika w store", async () => {
    vi.spyOn(authClient, "updateNickname").mockResolvedValue({ ...USER, nickname: "Ares" });
    renderModal();
    fireEvent.change(screen.getByLabelText("Pseudonim"), { target: { value: "  Ares  " } });
    fireEvent.click(screen.getByRole("button", { name: "Zapisz" }));

    await waitFor(() => expect(useAuthStore.getState().user?.nickname).toBe("Ares"));
    expect(authClient.updateNickname).toHaveBeenCalledWith("Ares");
  });

  it("włącza authenticator: pokazuje klucz, wysyła kod i odświeża profil", async () => {
    vi.spyOn(authClient, "totpSetup").mockResolvedValue({ secret: "JBSWY3DPEHPK3PXP", otpauthUri: "otpauth://totp/x" });
    const enable = vi.spyOn(authClient, "totpEnable").mockResolvedValue({ message: "ok" });
    vi.spyOn(authClient, "me").mockResolvedValue({ ...USER, totpEnabled: true });
    renderModal();

    fireEvent.click(screen.getByRole("button", { name: "Włącz authenticator" }));
    await waitFor(() => expect(screen.getByTestId("totp-secret").textContent).toBe("JBSWY3DPEHPK3PXP"));
    fireEvent.change(screen.getByLabelText("Kod z aplikacji authenticator"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Potwierdź i włącz" }));

    await waitFor(() => expect(screen.getByText("Authenticator jest włączony.")).toBeTruthy());
    expect(enable).toHaveBeenCalledWith("123456");
  });

  it("pobiera dane jako plik JSON", async () => {
    const blob = new Blob(["{}"], { type: "application/json" });
    vi.spyOn(authClient, "exportMyData").mockResolvedValue(blob);
    const createObjectURL = vi.fn().mockReturnValue("blob:test");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL }));
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderModal();

    fireEvent.click(screen.getByRole("button", { name: "Pobierz dane (JSON)" }));

    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test");
  });
});
