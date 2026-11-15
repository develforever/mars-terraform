import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import i18n from "../../../../app/i18n";
import { NetworkGameModal } from "../NetworkGameModal";
import { useNetworkStore } from "../../../../application/store/useNetworkStore";
import { useGameStore } from "../../../../application/store/useGameStore";
import { TimeControls } from "../TimeControls";
import { NetworkRoomPanel } from "../NetworkRoomPanel";

const renderModal = (initialCode?: string) =>
  render(
    <MemoryRouter>
      <NetworkGameModal onClose={vi.fn()} initialCode={initialCode} />
    </MemoryRouter>,
  );

describe("NetworkGameModal (F9-T5)", () => {
  const joinRoom = vi.fn();
  const createRoom = vi.fn();

  beforeEach(async () => {
    await i18n.changeLanguage("pl");
    useGameStore.getState().resetGame();
    useNetworkStore.setState({ serverAvailable: true, phase: "idle", issue: null, nickname: "", joinRoom, createRoom });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("bez serwera gry pokazuje, że działa tylko gra solo", () => {
    useNetworkStore.setState({ serverAvailable: false });
    renderModal();
    expect(screen.getByText(/działa tylko gra solo/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dołącz" })).not.toBeInTheDocument();
  });

  it("dołączenie wymaga poprawnego pseudonimu i kodu (kod z linku wypełniony)", () => {
    renderModal("MARS-4K7Q");
    const join = screen.getByRole("button", { name: "Dołącz" });
    expect(join).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Pseudonim/), { target: { value: "Ania" } });
    expect(join).toBeEnabled();
    fireEvent.click(join);
    expect(joinRoom).toHaveBeenCalledWith("MARS-4K7Q", "Ania");
  });

  it("utworzenie pokoju wymaga kolonii", () => {
    renderModal();
    fireEvent.change(screen.getByLabelText(/Pseudonim/), { target: { value: "Host" } });
    expect(screen.getByRole("button", { name: /Utwórz pokój/ })).toBeDisabled();
    expect(screen.getByText(/najpierw rozpocznij albo wczytaj kolonię/)).toBeInTheDocument();

    useGameStore.getState().startNewGame("Baza", "normal", "exploration");
    renderModal();
    fireEvent.change(screen.getAllByLabelText(/Pseudonim/)[1], { target: { value: "Host" } });
    fireEvent.click(screen.getAllByRole("button", { name: /Utwórz pokój/ })[1]);
    expect(createRoom).toHaveBeenCalledWith("Host");
  });

  it("pokazuje komunikat błędu sesji", () => {
    useNetworkStore.setState({ issue: "room_full" });
    renderModal();
    expect(screen.getByRole("alert")).toHaveTextContent("Pokój jest pełny");
  });
});

describe("TimeControls w grze sieciowej", () => {
  it("pauza i prędkość są ukryte, bo czas liczy serwer", () => {
    useGameStore.setState({ remoteCommandSink: vi.fn() });
    render(<TimeControls />);
    expect(screen.queryByTestId("time-controls")).not.toBeInTheDocument();
    useGameStore.setState({ remoteCommandSink: null });
  });
});

describe("NetworkRoomPanel", () => {
  it("jest klikalny mimo pointer-events: none w .hud i pozwala opuścić pokój", async () => {
    await i18n.changeLanguage("pl");
    const leaveRoom = vi.fn();
    useNetworkStore.setState({
      phase: "in_room",
      roomCode: "MARS-4K7Q",
      playerId: "p2",
      players: [
        { id: "p1", nickname: "Ania" },
        { id: "p2", nickname: "Bartek" },
      ],
      issue: null,
      lastRejected: null,
      leaveRoom,
    });
    render(<NetworkRoomPanel />);
    const panel = screen.getByTestId("network-room-panel");
    expect(panel).toHaveClass("pointer-events-auto");
    expect(panel).toHaveTextContent("Gracze (2/4)");
    expect(panel).toHaveTextContent("Bartek · ty");
    fireEvent.click(screen.getByRole("button", { name: "Opuść" }));
    expect(leaveRoom).toHaveBeenCalledTimes(1);
  });
});
