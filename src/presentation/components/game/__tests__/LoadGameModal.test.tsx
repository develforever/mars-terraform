import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router";
import i18n from "../../../../app/i18n";
import { LoadGameModal } from "../LoadGameModal";
import { LocalDataNotice, LOCAL_DATA_NOTICE_KEY } from "../../ui/LocalDataNotice";
import { createLocalStorageStore, setBrowserStoreForTests } from "../../../../application/service/browserStore";
import { colonySaveService } from "../../../../application/service/colonySaveService";
import { LocalSaveService } from "../../../../application/service/localSaveService";
import { useGameStore } from "../../../../application/store/useGameStore";

const navigate = vi.fn();
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useNavigate: () => navigate };
});

const save = (name: string, timestamp: number) => ({ ...LocalSaveService.buildSavedGame({ colonyName: name, sol: 4 }), timestamp });

const renderModal = (onClose = vi.fn()) => {
  render(
    <MemoryRouter>
      <LoadGameModal onClose={onClose} />
    </MemoryRouter>,
  );
  return onClose;
};

describe("LoadGameModal (T14: zapisy w przeglądarce)", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pl");
    localStorage.clear();
    setBrowserStoreForTests(createLocalStorageStore(localStorage));
    navigate.mockReset();
  });

  afterEach(() => {
    setBrowserStoreForTests(null);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("informuje, że zapisy są tylko w tej przeglądarce, i listuje zapisy lokalne", async () => {
    await colonySaveService.save(save("Ares", 1000));
    renderModal();

    expect(screen.getByRole("note").textContent).toContain("tylko w tej przeglądarce");
    expect(await screen.findByText("🏛 Ares")).toBeTruthy();
  });

  it("pobiera zapis jako plik JSON", async () => {
    await colonySaveService.save(save("Ares", 1000));
    const createObjectURL = vi.fn().mockReturnValue("blob:save");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderModal();

    fireEvent.click(await screen.findByRole("button", { name: "Pobierz plik zapisu: Ares" }));

    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
    const text = await (createObjectURL.mock.calls[0][0] as Blob).text();
    expect(colonySaveService.fromFile(text).colonyName).toBe("Ares");
  });

  it("wczytuje zapis z pliku i przechodzi do gry", async () => {
    const importSaveFile = vi.fn().mockResolvedValue(undefined);
    useGameStore.setState({ importSaveFile });
    const onClose = renderModal();

    const file = new File([colonySaveService.toFile(save("Z pliku", 1))], "save.json", { type: "application/json" });
    fireEvent.change(screen.getByTestId("import-save-input"), { target: { files: [file] } });

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/mars"));
    expect(importSaveFile).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
  });

  it("pokazuje błąd dla złego pliku", async () => {
    useGameStore.setState({ importSaveFile: vi.fn().mockRejectedValue(new Error("Not a Mars Terraform save file")) });
    renderModal();

    const file = new File(["{}"], "zly.json", { type: "application/json" });
    fireEvent.change(screen.getByTestId("import-save-input"), { target: { files: [file] } });

    expect(await screen.findByText("To nie jest poprawny plik zapisu Mars Terraform.")).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe("LocalDataNotice (T14)", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pl");
    localStorage.clear();
  });

  it("pokazuje informację o grze bez konta i zapamiętuje zamknięcie", () => {
    const { unmount } = render(
      <MemoryRouter>
        <LocalDataNotice />
      </MemoryRouter>,
    );
    expect(screen.getByText("Grasz bez konta")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Rozumiem" }));
    expect(screen.queryByText("Grasz bez konta")).toBeNull();
    expect(localStorage.getItem(LOCAL_DATA_NOTICE_KEY)).toBe("1");
    unmount();

    render(
      <MemoryRouter>
        <LocalDataNotice />
      </MemoryRouter>,
    );
    expect(screen.queryByText("Grasz bez konta")).toBeNull();
  });
});
