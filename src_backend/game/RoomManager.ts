import { randomInt, randomUUID } from "crypto";
import { createSeededRng, type Rng } from "../../src/domain/random/Rng";
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  ROOM_CODE_PREFIX,
  type ClientMessage,
  type HexGridWire,
  type NetworkErrorCode,
  type NetworkPlayer,
  type RoomClosedReason,
  type RoomGameState,
  type ServerMessage,
} from "../../src/domain/network/NetworkProtocol";
import { applyRoomCommand, createRoomState, stepRoomState, toSnapshot } from "../../src/domain/network/RoomState";

/**
 * Pokoje gry sieciowej w pamięci procesu (F9-T4, D5–D7). Bez zapisu na dysk i bez logowania danych graczy:
 * pokój znika, gdy wyjdzie ostatni gracz albo po czasie bezczynności. Transport (WebSocket) jest poza tą klasą.
 */

/** Połączenie gracza widziane przez menedżer (implementuje je warstwa WebSocket). */
export interface PlayerConnection {
  send(data: string): void;
  close(code: number, reason: string): void;
}

export interface RoomManagerOptions {
  /** Maksymalna liczba pokoi w procesie (D7). */
  readonly maxRooms: number;
  /** Maksymalna liczba graczy w pokoju (D7). */
  readonly maxPlayersPerRoom: number;
  /** Pokój bez komend i dołączeń przez ten czas jest zamykany (D7). */
  readonly idleTimeoutMs: number;
  /** Średni limit komend na sekundę na połączenie (token bucket). */
  readonly commandsPerSecond: number;
  /** Chwilowy zapas komend ponad średnią. */
  readonly commandBurst: number;
  /** Nieudane próby dołączenia na połączenie, po których połączenie jest zamykane (ochrona kodów pokoi). */
  readonly maxFailedJoins: number;
  readonly now?: () => number;
  readonly generateCode?: () => string;
  readonly createRng?: () => Rng;
}

export const DEFAULT_ROOM_MANAGER_OPTIONS: RoomManagerOptions = {
  maxRooms: 20,
  maxPlayersPerRoom: 4,
  idleTimeoutMs: 30 * 60 * 1000,
  commandsPerSecond: 5,
  commandBurst: 10,
  maxFailedJoins: 5,
};

/** Kod zamknięcia WebSocket dla połączenia, które przekroczyło limit prób dołączenia (zakres 4000-4999 = aplikacja). */
export const CLOSE_TOO_MANY_ATTEMPTS = 4001;

export const generateRoomCode = (): string => {
  let code = ROOM_CODE_PREFIX;
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
  }
  return code;
};

const createRandomRng = (): Rng => createSeededRng(randomInt(0x100000000));

interface RoomPlayer {
  readonly id: string;
  readonly nickname: string;
  readonly connection: PlayerConnection;
}

interface Room {
  readonly code: string;
  readonly hexGrid: HexGridWire;
  readonly rng: Rng;
  readonly players: Map<string, RoomPlayer>;
  state: RoomGameState;
  lastActivity: number;
}

interface ConnectionInfo {
  roomCode: string | null;
  playerId: string | null;
  tokens: number;
  lastRefill: number;
  failedJoins: number;
}

export class RoomManager {
  private readonly options: RoomManagerOptions;
  private readonly now: () => number;
  private readonly generateCode: () => string;
  private readonly createRng: () => Rng;
  private readonly rooms = new Map<string, Room>();
  private readonly connections = new Map<PlayerConnection, ConnectionInfo>();

  constructor(options: Partial<RoomManagerOptions> = {}) {
    this.options = { ...DEFAULT_ROOM_MANAGER_OPTIONS, ...options };
    this.now = this.options.now ?? Date.now;
    this.generateCode = this.options.generateCode ?? generateRoomCode;
    this.createRng = this.options.createRng ?? createRandomRng;
  }

  get roomCount(): number {
    return this.rooms.size;
  }

  /** Obsługa zwalidowanej wiadomości klienta (`clientMessageSchema`). */
  handleMessage(connection: PlayerConnection, message: ClientMessage): void {
    const info = this.getInfo(connection);
    switch (message.type) {
      case "create_room":
        this.createRoom(connection, info, message.nickname, message.hexGrid, message.state);
        return;
      case "join_room":
        this.joinRoom(connection, info, message.code, message.nickname);
        return;
      case "command":
        this.runCommand(connection, info, message.command);
        return;
      case "leave_room":
        this.leaveRoom(info);
        return;
    }
  }

  /** Połączenie zamknięte: gracz opuszcza pokój. */
  disconnect(connection: PlayerConnection): void {
    const info = this.connections.get(connection);
    if (!info) return;
    this.leaveRoom(info);
    this.connections.delete(connection);
  }

  /** Jeden tick wszystkich pokoi (serwer woła co 1 s): zamknięcie bezczynnych, symulacja, snapshot. */
  tickAll(): void {
    const now = this.now();
    for (const room of [...this.rooms.values()]) {
      if (now - room.lastActivity > this.options.idleTimeoutMs) {
        this.closeRoom(room, "idle");
        continue;
      }
      try {
        room.state = stepRoomState(room.state, room.rng);
      } catch (error: unknown) {
        console.error("[game] room tick failed:", error instanceof Error ? error.message : "unknown error");
        this.closeRoom(room, "error");
        continue;
      }
      this.broadcastSnapshot(room);
    }
  }

  /** Zamyka wszystkie pokoje (zatrzymanie serwera). */
  closeAll(): void {
    for (const room of [...this.rooms.values()]) {
      this.closeRoom(room, "shutdown");
    }
  }

  private getInfo(connection: PlayerConnection): ConnectionInfo {
    let info = this.connections.get(connection);
    if (!info) {
      info = { roomCode: null, playerId: null, tokens: this.options.commandBurst, lastRefill: this.now(), failedJoins: 0 };
      this.connections.set(connection, info);
    }
    return info;
  }

  private createRoom(
    connection: PlayerConnection,
    info: ConnectionInfo,
    nickname: string,
    hexGrid: HexGridWire,
    initial: Parameters<typeof createRoomState>[0],
  ): void {
    if (info.roomCode) {
      this.sendError(connection, "already_in_room");
      return;
    }
    if (this.rooms.size >= this.options.maxRooms) {
      this.sendError(connection, "server_full");
      return;
    }
    const code = this.uniqueCode();
    if (!code) {
      this.sendError(connection, "server_full");
      return;
    }
    let state: RoomGameState;
    try {
      state = createRoomState(initial, hexGrid);
    } catch {
      this.sendError(connection, "bad_message");
      return;
    }
    const room: Room = { code, hexGrid, rng: this.createRng(), players: new Map(), state, lastActivity: this.now() };
    this.rooms.set(code, room);
    console.log(`[game] room created (rooms: ${this.rooms.size})`);
    this.addPlayer(room, connection, info, nickname);
  }

  private joinRoom(connection: PlayerConnection, info: ConnectionInfo, code: string, nickname: string): void {
    if (info.roomCode) {
      this.sendError(connection, "already_in_room");
      return;
    }
    const room = this.rooms.get(code);
    if (!room) {
      info.failedJoins++;
      this.sendError(connection, "room_not_found");
      if (info.failedJoins >= this.options.maxFailedJoins) {
        this.sendError(connection, "too_many_attempts");
        connection.close(CLOSE_TOO_MANY_ATTEMPTS, "too_many_attempts");
      }
      return;
    }
    if (room.players.size >= this.options.maxPlayersPerRoom) {
      this.sendError(connection, "room_full");
      return;
    }
    room.lastActivity = this.now();
    this.addPlayer(room, connection, info, nickname);
  }

  private addPlayer(room: Room, connection: PlayerConnection, info: ConnectionInfo, nickname: string): void {
    const player: RoomPlayer = { id: randomUUID(), nickname, connection };
    room.players.set(player.id, player);
    info.roomCode = room.code;
    info.playerId = player.id;
    const players = this.listPlayers(room);
    this.send(connection, {
      type: "room_joined",
      code: room.code,
      playerId: player.id,
      players,
      hexGrid: room.hexGrid,
      state: toSnapshot(room.state),
    });
    this.broadcast(room, { type: "players", players }, player.id);
  }

  private runCommand(connection: PlayerConnection, info: ConnectionInfo, command: Parameters<typeof applyRoomCommand>[1]): void {
    const room = info.roomCode ? this.rooms.get(info.roomCode) : undefined;
    if (!room) {
      this.sendError(connection, "not_in_room");
      return;
    }
    if (!this.takeToken(info)) {
      this.sendError(connection, "rate_limited");
      return;
    }
    const result = applyRoomCommand(room.state, command);
    if (!result.ok) {
      this.send(connection, { type: "command_rejected", reason: result.reason });
      return;
    }
    room.state = result.state;
    room.lastActivity = this.now();
    this.broadcastSnapshot(room);
  }

  private leaveRoom(info: ConnectionInfo): void {
    const room = info.roomCode ? this.rooms.get(info.roomCode) : undefined;
    if (room && info.playerId) {
      room.players.delete(info.playerId);
      if (room.players.size === 0) {
        this.removeRoom(room);
      } else {
        this.broadcast(room, { type: "players", players: this.listPlayers(room) });
      }
    }
    info.roomCode = null;
    info.playerId = null;
  }

  private closeRoom(room: Room, reason: RoomClosedReason): void {
    this.broadcast(room, { type: "room_closed", reason });
    for (const player of room.players.values()) {
      const info = this.connections.get(player.connection);
      if (info) {
        info.roomCode = null;
        info.playerId = null;
      }
    }
    this.removeRoom(room, reason);
  }

  private removeRoom(room: Room, reason: RoomClosedReason | "empty" = "empty"): void {
    this.rooms.delete(room.code);
    console.log(`[game] room closed: ${reason} (rooms: ${this.rooms.size})`);
  }

  private uniqueCode(): string | null {
    for (let attempt = 0; attempt < 20; attempt++) {
      const code = this.generateCode();
      if (!this.rooms.has(code)) return code;
    }
    return null;
  }

  /** Token bucket: `commandsPerSecond` średnio, `commandBurst` chwilowo. */
  private takeToken(info: ConnectionInfo): boolean {
    const now = this.now();
    const elapsedSeconds = Math.max(0, now - info.lastRefill) / 1000;
    info.tokens = Math.min(this.options.commandBurst, info.tokens + elapsedSeconds * this.options.commandsPerSecond);
    info.lastRefill = now;
    if (info.tokens < 1) return false;
    info.tokens -= 1;
    return true;
  }

  private listPlayers(room: Room): NetworkPlayer[] {
    return [...room.players.values()].map(({ id, nickname }) => ({ id, nickname }));
  }

  private broadcastSnapshot(room: Room): void {
    this.broadcast(room, { type: "snapshot", state: toSnapshot(room.state) });
  }

  /** Serializuje wiadomość raz i wysyła wszystkim graczom pokoju (opcjonalnie z pominięciem jednego). */
  private broadcast(room: Room, message: ServerMessage, exceptPlayerId?: string): void {
    const data = JSON.stringify(message);
    for (const player of room.players.values()) {
      if (player.id !== exceptPlayerId) player.connection.send(data);
    }
  }

  private send(connection: PlayerConnection, message: ServerMessage): void {
    connection.send(JSON.stringify(message));
  }

  private sendError(connection: PlayerConnection, error: NetworkErrorCode): void {
    this.send(connection, { type: "error", error });
  }
}
