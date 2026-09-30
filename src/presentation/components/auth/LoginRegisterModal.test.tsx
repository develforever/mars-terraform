import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router";
import i18n from "../../../app/i18n";
import LoginModal from "./LoginModal";
import RegisterModal from "./RegisterModal";
import { useAuthStore } from "../../../application/store/useAuthStore";
import { ApiError, TOTP_REQUIRED_MESSAGE } from "../../../application/service/authService";
import { useModalStore } from "../../../ui/ModalManager/store";

const NUMBER = "7KQ2-M9XA-4TRE-01ZC-8HNP";

const renderIn = (node: React.ReactNode) => render(<MemoryRouter>{node}</MemoryRouter>);

describe("LoginModal (T13)", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pl");
    useModalStore.setState({ isOpen: true, modalType: "login" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loguje numerem konta i zamyka okno", async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({ login, isLoading: false });
    renderIn(<LoginModal />);

    fireEvent.change(screen.getByLabelText("Numer konta"), { target: { value: NUMBER } });
    fireEvent.click(screen.getByRole("button", { name: "Zaloguj się" }));

    await waitFor(() => expect(useModalStore.getState().isOpen).toBe(false));
    expect(login).toHaveBeenCalledWith(NUMBER, undefined);
  });

  it("po odpowiedzi TOTP required dopytuje o kod i wysyła go przy drugiej próbie", async () => {
    const login = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(TOTP_REQUIRED_MESSAGE, 401))
      .mockResolvedValueOnce(undefined);
    useAuthStore.setState({ login, isLoading: false });
    renderIn(<LoginModal />);

    fireEvent.change(screen.getByLabelText("Numer konta"), { target: { value: NUMBER } });
    fireEvent.click(screen.getByRole("button", { name: "Zaloguj się" }));
    const codeInput = await screen.findByLabelText("Kod z aplikacji authenticator");
    expect(screen.queryByRole("alert")).toBeNull();

    fireEvent.change(codeInput, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Zaloguj się" }));

    await waitFor(() => expect(login).toHaveBeenLastCalledWith(NUMBER, "123456"));
  });

  it("pokazuje błąd dla złego numeru", async () => {
    useAuthStore.setState({ login: vi.fn().mockRejectedValue(new ApiError("Invalid account number or code", 401)), isLoading: false });
    renderIn(<LoginModal />);

    fireEvent.change(screen.getByLabelText("Numer konta"), { target: { value: "zly" } });
    fireEvent.click(screen.getByRole("button", { name: "Zaloguj się" }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Invalid account number or code"));
  });
});

describe("RegisterModal (T13)", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pl");
    useModalStore.setState({ isOpen: true, modalType: "register" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("tworzy konto, pokazuje numer i blokuje zamknięcie do potwierdzenia zapisu", async () => {
    useAuthStore.setState({ register: vi.fn().mockResolvedValue(NUMBER), isLoading: false });
    renderIn(<RegisterModal />);

    fireEvent.click(screen.getByRole("button", { name: "Utwórz konto" }));
    await waitFor(() => expect(screen.getByTestId("account-number").textContent).toBe(NUMBER));

    expect(screen.queryByLabelText("Zamknij")).toBeNull();
    const done = screen.getByRole("button", { name: "Gotowe" }) as HTMLButtonElement;
    expect(done.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText("Zapisałem numer konta w bezpiecznym miejscu"));
    expect(done.disabled).toBe(false);
    fireEvent.click(done);
    expect(useModalStore.getState().isOpen).toBe(false);
  });

  it("kopiuje numer do schowka i pobiera go jako plik tekstowy", async () => {
    useAuthStore.setState({ register: vi.fn().mockResolvedValue(NUMBER), isLoading: false });
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    const createObjectURL = vi.fn().mockReturnValue("blob:acc");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderIn(<RegisterModal />);

    fireEvent.click(screen.getByRole("button", { name: "Utwórz konto" }));
    await screen.findByTestId("account-number");
    fireEvent.click(screen.getByRole("button", { name: "Kopiuj" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(NUMBER));
    fireEvent.click(screen.getByRole("button", { name: "Pobierz plik" }));

    expect(clickSpy).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(await blob.text()).toContain(NUMBER);
  });

  it("pokazuje błąd limitu rejestracji", async () => {
    useAuthStore.setState({ register: vi.fn().mockRejectedValue(new ApiError("Too many new accounts, try again later", 429)), isLoading: false });
    renderIn(<RegisterModal />);

    fireEvent.click(screen.getByRole("button", { name: "Utwórz konto" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Too many new accounts, try again later"));
  });
});
