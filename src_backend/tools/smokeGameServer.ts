import { WebSocket } from "ws";
import { GAME_SOCKET_PATH, type ClientMessage, type ServerMessage } from "../../src/domain/network/NetworkProtocol";
import { createRoomMessage } from "../test/roomFixture";

/**
 * Smoke test serwera gry (F9-T7) pod publicznym adresem (LAN albo tunel): strona i nagłówki, `/api/health`,
 * a potem pełna sesja przez WebSocket - gospodarz tworzy pokój, gość dołącza, komenda gościa dociera do
 * gospodarza, tick biegnie. Łączy się jak przeglądarka z tej strony (nagłówek `Origin` = adres serwera).
 */

/** Liczba kroków pełnego testu (każdy musi przejść). */
export const SMOKE_STEP_COUNT = 6;

export interface SmokeStep {
  readonly name: string;
  readonly ok: boolean;
  readonly detail?: string;
}

export interface SmokeOptions {
  readonly timeoutMs?: number;
  readonly fetchFn?: typeof fetch;
}

/** ngrok (plan darmowy) pokazuje przeglądarkom stronę ostrzegawczą; ten nagłówek ją pomija dla narzędzi. */
const TUNNEL_HEADERS = { "ngrok-skip-browser-warning": "1" };

const socketUrl = (base: URL): string => {
  const url = new URL(GAME_SOCKET_PATH, base);
  url.protocol = base.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
};

class SmokeClient {
  private readonly ws: WebSocket;
  private readonly messages: ServerMessage[] = [];
  private readonly waiters = new Set<() => void>();

  constructor(url: string, origin: string) {
    this.ws = new WebSocket(url, { origin, headers: TUNNEL_HEADERS });
    this.ws.on("message", (data: Buffer) => {
      this.messages.push(JSON.parse(data.toString()) as ServerMessage);
      for (const wake of this.waiters) wake();
    });
    this.ws.on("error", () => {});
  }

  opened(timeoutMs: number): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("WebSocket: timeout")), timeoutMs);
      this.ws.once("open", () => {
        clearTimeout(timer);
        resolve();
      });
      this.ws.once("unexpected-response", (_req, res) => {
        clearTimeout(timer);
        reject(new Error(`WebSocket: HTTP ${res.statusCode ?? "?"}`));
      });
      this.ws.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  send(message: ClientMessage): void {
    this.ws.send(JSON.stringify(message));
  }

  /** Czeka na wiadomość spełniającą warunek (także taką, która już przyszła). */
  waitFor<T extends ServerMessage>(match: (m: ServerMessage) => m is T, timeoutMs: number, what: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const check = (): boolean => {
        const found = this.messages.find(match);
        if (!found) return false;
        cleanup();
        resolve(found);
        return true;
      };
      const timer = setTimeout(() => {
        cleanup();
        const error = this.messages.find((m) => m.type === "error");
        reject(new Error(`${what}: timeout${error?.type === "error" ? ` (server error: ${error.error})` : ""}`));
      }, timeoutMs);
      const cleanup = () => {
        clearTimeout(timer);
        this.waiters.delete(wake);
      };
      const wake = () => void check();
      if (!check()) this.waiters.add(wake);
    });
  }

  close(): void {
    this.ws.close();
  }
}

const isType =
  <K extends ServerMessage["type"]>(type: K, accept: (m: Extract<ServerMessage, { type: K }>) => boolean = () => true) =>
  (m: ServerMessage): m is Extract<ServerMessage, { type: K }> =>
    m.type === type && accept(m as Extract<ServerMessage, { type: K }>);

export const runSmokeTest = async (address: string, options: SmokeOptions = {}): Promise<SmokeStep[]> => {
  const { timeoutMs = 10_000, fetchFn = fetch } = options;
  const steps: SmokeStep[] = [];
  const step = async (name: string, run: () => Promise<string | undefined>): Promise<boolean> => {
    try {
      steps.push({ name, ok: true, detail: await run() });
      return true;
    } catch (error: unknown) {
      steps.push({ name, ok: false, detail: error instanceof Error ? error.message : String(error) });
      return false;
    }
  };

  const base = new URL(address);
  const origin = base.origin;

  await step("strona gry i nagłówki", async () => {
    const res = await fetchFn(new URL("/", base), { headers: TUNNEL_HEADERS });
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
    const csp = res.headers.get("content-security-policy") ?? "";
    if (!csp.includes("connect-src 'self'")) throw new Error("brak CSP z connect-src 'self'");
    return `HTTP 200, CSP OK`;
  });

  const healthy = await step("/api/health", async () => {
    const res = await fetchFn(new URL("/api/health", base), { headers: TUNNEL_HEADERS });
    const body = (await res.json()) as { status?: string; version?: string };
    if (res.status !== 200 || body.status !== "ok") throw new Error(`HTTP ${res.status}`);
    return `wersja ${body.version ?? "?"}`;
  });
  if (!healthy) return steps;

  const url = socketUrl(base);
  const host = new SmokeClient(url, origin);
  const clients = [host];
  let guest: SmokeClient | null = null;
  try {
    let code = "";
    const created = await step("gospodarz tworzy pokój", async () => {
      await host.opened(timeoutMs);
      host.send(createRoomMessage("Smoke-Host"));
      const joined = await host.waitFor(isType("room_joined"), timeoutMs, "room_joined");
      code = joined.code;
      return undefined;
    });
    if (!created) return steps;

    const joined = await step("gość dołącza po kodzie", async () => {
      guest = new SmokeClient(url, origin);
      clients.push(guest);
      await guest.opened(timeoutMs);
      guest.send({ type: "join_room", code, nickname: "Smoke-Guest" });
      const room = await guest.waitFor(isType("room_joined"), timeoutMs, "room_joined");
      await host.waitFor(isType("players", (m) => m.players.length === 2), timeoutMs, "players");
      return `${room.players.length} graczy`;
    });
    if (!joined) return steps;

    await step("komenda gościa dociera do gospodarza", async () => {
      guest?.send({ type: "command", command: { type: "toggle_building_power", buildingId: "b-1" } });
      await host.waitFor(isType("snapshot", (m) => m.state.placed[0]?.disabled === true), timeoutMs, "snapshot");
      return undefined;
    });

    await step("tick serwera", async () => {
      const first = await host.waitFor(isType("snapshot"), timeoutMs, "snapshot");
      const startTick = first.state.tick;
      await host.waitFor(isType("snapshot", (m) => m.state.tick > startTick), timeoutMs, "kolejny tick");
      return undefined;
    });
  } finally {
    for (const client of clients) client.close();
  }
  return steps;
};
