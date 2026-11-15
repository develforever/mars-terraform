import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { ClientMessage, NetworkErrorCode, NetworkPlayer, RoomClosedReason, ServerMessage } from "../../domain/network/NetworkProtocol";
import { toRoomStart } from "../../domain/network/RoomState";
import { checkGameServerAvailable, gameSocketUrl, GameSocketClient, type GameSocketOptions } from "../service/networkClient";
import { useGameStore } from "./useGameStore";

/**
 * Gra sieciowa po stronie klienta (F9-T5): połączenie, pokój, gracze. Stan gry trafia do `useGameStore`
 * (`enterNetworkGame` / `applyNetworkSnapshot`), a komendy gracza idą do serwera przez `remoteCommandSink`.
 * Po zerwaniu połączenia klient łączy się ponownie i dołącza do tego samego pokoju (nowy identyfikator gracza).
 */

export type NetworkPhase = "idle" | "connecting" | "in_room" | "reconnecting";
export type NetworkIssue = NetworkErrorCode | RoomClosedReason | "connection_lost";

export interface NetworkState {
  /** `null` = jeszcze nie sprawdzono; `false` = statyczny hosting, tylko gra solo (D3). */
  serverAvailable: boolean | null;
  phase: NetworkPhase;
  roomCode: string | null;
  playerId: string | null;
  players: NetworkPlayer[];
  isHost: boolean;
  nickname: string;
  issue: NetworkIssue | null;
  lastRejected: string | null;

  checkServer: () => Promise<void>;
  /** Tworzy pokój z bieżącej kolonii gracza (gospodarz). */
  createRoom: (nickname: string) => void;
  joinRoom: (code: string, nickname: string) => void;
  leaveRoom: () => void;
  clearIssue: () => void;
}

/** Konfiguracja transportu (testy podmieniają gniazdo, adres i sprawdzenie serwera). */
export const networkConfig: {
  socketUrl: () => string;
  socketOptions: GameSocketOptions;
  checkAvailable: () => Promise<boolean>;
} = {
  socketUrl: () => gameSocketUrl(window.location),
  socketOptions: {},
  checkAvailable: () => checkGameServerAvailable(),
};

/** Błędy, które w pokoju są tylko informacją; pozostałe kończą sesję. */
const NON_FATAL_ERRORS: ReadonlySet<NetworkErrorCode> = new Set(["rate_limited", "bad_message"]);

let client: GameSocketClient | null = null;
/** Pierwsze `room_joined` sesji: gość buduje świat z danych serwera, gospodarz zostaje przy swoim. */
let awaitingFirstJoin = false;
let cleaningUp = false;

export const useNetworkStore = create<NetworkState>()(
  devtools(
    (set, get) => {
      const endSession = (issue: NetworkIssue | null): void => {
        cleaningUp = true;
        client?.close();
        client = null;
        awaitingFirstJoin = false;
        if (useGameStore.getState().remoteCommandSink) useGameStore.getState().exitNetworkGame();
        cleaningUp = false;
        set({ phase: "idle", roomCode: null, playerId: null, players: [], isHost: false, issue, lastRejected: null });
      };

      const handleMessage = (message: ServerMessage): void => {
        switch (message.type) {
          case "room_joined": {
            const keepLocalWorld = !awaitingFirstJoin || get().isHost;
            awaitingFirstJoin = false;
            set({ phase: "in_room", roomCode: message.code, playerId: message.playerId, players: [...message.players], issue: null });
            useGameStore.getState().enterNetworkGame({
              roomCode: message.code,
              hexGrid: message.hexGrid,
              snapshot: message.state,
              sink: (command) => client?.send({ type: "command", command }),
              keepLocalWorld,
            });
            return;
          }
          case "players":
            set({ players: [...message.players] });
            return;
          case "snapshot":
            useGameStore.getState().applyNetworkSnapshot(message.state);
            return;
          case "command_rejected":
            set({ lastRejected: message.reason });
            return;
          case "error":
            if (get().phase === "in_room" && NON_FATAL_ERRORS.has(message.error)) {
              set({ issue: message.error });
              return;
            }
            endSession(message.error);
            return;
          case "room_closed":
            endSession(message.reason);
            return;
        }
      };

      const startSession = (firstMessage: () => ClientMessage, nickname: string, isHost: boolean): void => {
        if (client) endSession(null);
        awaitingFirstJoin = true;
        set({ phase: "connecting", nickname, isHost, issue: null, lastRejected: null });
        client = new GameSocketClient(
          networkConfig.socketUrl(),
          {
            onOpen: (reconnected) => {
              const { roomCode } = get();
              if (reconnected && roomCode) {
                set({ phase: "in_room" });
                client?.send({ type: "join_room", code: roomCode, nickname });
              } else if (!reconnected) {
                client?.send(firstMessage());
              }
            },
            onMessage: handleMessage,
            onReconnecting: () => set({ phase: "reconnecting" }),
            onConnectionLost: () => endSession("connection_lost"),
          },
          networkConfig.socketOptions,
        );
        client.connect();
      };

      return {
        serverAvailable: null,
        phase: "idle",
        roomCode: null,
        playerId: null,
        players: [],
        isHost: false,
        nickname: "",
        issue: null,
        lastRejected: null,

        checkServer: async () => {
          set({ serverAvailable: await networkConfig.checkAvailable() });
        },

        createRoom: (nickname) => {
          startSession(() => ({ type: "create_room", nickname, ...toRoomStart(useGameStore.getState()) }) as ClientMessage, nickname, true);
        },

        joinRoom: (code, nickname) => {
          startSession(() => ({ type: "join_room", code: code.trim().toUpperCase(), nickname }), nickname, false);
        },

        leaveRoom: () => {
          client?.send({ type: "leave_room" });
          endSession(null);
        },

        clearIssue: () => set({ issue: null }),
      };
    },
    { name: "NetworkStore", enabled: true },
  ),
);

/** Wyjście z gry (np. `resetGame` po „Wyjdź”) kończy też sesję sieciową. */
useGameStore.subscribe((state, previous) => {
  if (!cleaningUp && previous.remoteCommandSink && !state.remoteCommandSink && useNetworkStore.getState().phase !== "idle") {
    useNetworkStore.getState().leaveRoom();
  }
});
