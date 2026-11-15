import { z } from "zod";
import type { SimulationState, SimulationUpdate } from "../simulation/GameSimulation";
import type { CommandState } from "../simulation/PlayerCommands";
import { playerCommandSchema } from "../simulation/PlayerCommands";

/**
 * Protokół gry sieciowej (Faza 9, F9-T4). Wspólny dla serwera gry (`src_backend/game`) i klienta (F9-T5).
 * Transport: WebSocket `/ws` na tym samym originie co frontend (D3), wiadomości JSON (tekst).
 * Serwer jest autorytatywny: klient wysyła komendy, serwer rozsyła snapshoty stanu (D4).
 * Bez kont i bez zapisu (D5, D6): gracz = losowy identyfikator sesji + pseudonim na czas pokoju.
 */

/** Ścieżka WebSocket serwera gry. */
export const GAME_SOCKET_PATH = "/ws";

/** Alfabet kodu pokoju bez znaków mylących (0/O, 1/I/L). */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_PREFIX = "MARS-";
export const ROOM_CODE_LENGTH = 4;

const ROOM_CODE_PATTERN = new RegExp(`^${ROOM_CODE_PREFIX}[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);

/** Kod pokoju, np. `MARS-4K7Q`; wielkość liter i spacje na brzegach bez znaczenia. */
export const roomCodeSchema = z.string().trim().toUpperCase().regex(ROOM_CODE_PATTERN);

export const NICKNAME_MAX_LENGTH = 20;

/** Pseudonim na czas pokoju (D6): litery, cyfry, spacja, `_`, `-`, `.`; bez znaków sterujących. */
export const nicknameSchema = z
  .string()
  .trim()
  .min(1)
  .max(NICKNAME_MAX_LENGTH)
  .regex(/^[\p{L}\p{N} _.-]+$/u);

/** Największa mapa (`hexRadius` 60) ma 3·60·61+1 heksów. */
const MAX_HEXES = 3 * 60 * 61 + 1;

/** Siatka heksów w formacie `HexGrid.toJSON()`; wysyłana raz przy wejściu do pokoju (teren się nie zmienia). */
export const hexGridWireSchema = z.object({
  radius: z.number().int().min(1).max(60),
  seed: z.number().finite(),
  hexes: z
    .array(
      z.object({
        q: z.number().int(),
        r: z.number().int(),
        terrainType: z.enum(["deep_crater", "lowland", "plains", "highland", "rocky", "peak"]),
        userType: z.enum(["empty", "build", "resource", "spawn"]).nullable(),
        decor: z.string().max(64).nullable(),
      }),
    )
    .max(MAX_HEXES),
});

export type HexGridWire = z.infer<typeof hexGridWireSchema>;

/** Stan gry pokoju: wszystko, czego potrzebują `stepSimulation` i `applyCommand`, plus pola wyliczane w ticku. */
export type RoomGameState = SimulationState & CommandState & Partial<Pick<SimulationUpdate, "sol" | "morale" | "lastDelta">>;

/** Snapshot rozsyłany graczom: stan pokoju bez siatki heksów. */
export type NetworkSnapshot = Omit<RoomGameState, "hexGrid">;

const finite = z.number().finite();
const entityList = (max: number) => z.array(z.record(z.string(), z.unknown())).max(max);
const entity = z.record(z.string(), z.unknown());

/**
 * Stan początkowy pokoju od gospodarza (już zhydratowany stan gry z jego przeglądarki).
 * Pola proste są sprawdzane dokładnie, encje tylko co do kształtu i liczności: w kooperacji gospodarz
 * jest zaufany (uruchamia serwer u siebie, D3), a błąd w ticku zamyka pokój zamiast serwera.
 */
export const initialRoomStateSchema = z.object({
  gameMode: z.enum(["adventure", "exploration", "survival"]),
  difficulty: z.enum(["easy", "normal", "hard"]),
  alive: z.boolean(),
  won: z.boolean(),
  isEndless: z.boolean(),
  tick: z.number().int().min(0),
  sol: finite.optional(),
  weather: entity,
  terraforming: finite,
  o2Accumulated: finite,
  waterLevel: finite,
  sun: finite,
  resources: z.object({ o2: finite, power: finite, water: finite, biomass: finite, minerals: finite }),
  capacity: z.object({ power: finite, water: finite, biomass: finite, minerals: finite }),
  placed: entityList(2000),
  occupied: z.record(z.string().max(64), z.string().max(128)),
  units: entityList(1000),
  resourceNodes: entityList(2000),
  population: entity,
  morale: entity.optional(),
  emergencyLifeSupport: entity,
  alienState: entity,
  aliensDefeated: z.number().int().min(0),
  researchPoints: finite,
  unlockedTechs: z.array(z.string().max(64)).max(200),
  activeQuests: entityList(200),
  analyticsSnapshots: entityList(500),
});

export type InitialRoomState = z.infer<typeof initialRoomStateSchema>;

export const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("create_room"), nickname: nicknameSchema, hexGrid: hexGridWireSchema, state: initialRoomStateSchema }),
  z.object({ type: z.literal("join_room"), code: roomCodeSchema, nickname: nicknameSchema }),
  z.object({ type: z.literal("command"), command: playerCommandSchema }),
  z.object({ type: z.literal("leave_room") }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

export interface NetworkPlayer {
  readonly id: string;
  readonly nickname: string;
}

export type NetworkErrorCode =
  | "bad_message"
  | "server_full"
  | "room_not_found"
  | "room_full"
  | "already_in_room"
  | "not_in_room"
  | "rate_limited"
  | "too_many_attempts";

export type RoomClosedReason = "idle" | "error" | "shutdown";

export type ServerMessage =
  | {
      readonly type: "room_joined";
      readonly code: string;
      readonly playerId: string;
      readonly players: readonly NetworkPlayer[];
      readonly hexGrid: HexGridWire;
      readonly state: NetworkSnapshot;
    }
  | { readonly type: "players"; readonly players: readonly NetworkPlayer[] }
  | { readonly type: "snapshot"; readonly state: NetworkSnapshot }
  | { readonly type: "command_rejected"; readonly reason: string }
  | { readonly type: "error"; readonly error: NetworkErrorCode }
  | { readonly type: "room_closed"; readonly reason: RoomClosedReason };
