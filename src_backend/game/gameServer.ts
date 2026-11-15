import type { IncomingMessage, Server } from "http";
import type { Duplex } from "stream";
import { WebSocket, WebSocketServer, type RawData } from "ws";
import { clientMessageSchema, GAME_SOCKET_PATH, type ServerMessage } from "../../src/domain/network/NetworkProtocol";
import { RoomManager, type PlayerConnection, type RoomManagerOptions } from "./RoomManager";

/**
 * Serwer gry sieciowej (F9-T4): WebSocket `/ws` na tym samym serwerze HTTP co frontend (D3, same-origin).
 * Upgrade tylko z dozwolonego `Origin` (ochrona przed cross-site WebSocket hijacking).
 */

export interface GameServerOptions {
  /** Dodatkowe dozwolone originy (np. Vite w dev, tunel przepisujący `Host`); zwykle `cors_origins`. */
  readonly allowedOrigins: readonly string[];
  /** Okres ticka symulacji w ms (D4: 1 tick/s). */
  readonly tickIntervalMs?: number;
  /** Okres pingu wykrywającego zerwane połączenia w ms. */
  readonly heartbeatIntervalMs?: number;
  readonly rooms?: Partial<RoomManagerOptions>;
}

export interface GameServer {
  readonly rooms: RoomManager;
  close(): Promise<void>;
}

/** Limit wiadomości: stan początkowy pokoju z dużą mapą mieści się z zapasem. */
export const MAX_MESSAGE_BYTES = 2 * 1024 * 1024;
/** Kolejne błędne wiadomości, po których połączenie jest zamykane. */
export const MAX_BAD_MESSAGES = 5;
export const CLOSE_POLICY_VIOLATION = 1008;

const firstHeader = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

/**
 * Origin dozwolony, gdy jego host jest hostem żądania (`Host` lub `X-Forwarded-Host` od tunelu) albo jest
 * na liście `allowedOrigins`. Przeglądarka nie pozwala stronie ustawić tych nagłówków dla WebSocket.
 */
export const isOriginAllowed = (req: IncomingMessage, allowedOrigins: readonly string[]): boolean => {
  const origin = firstHeader(req.headers.origin);
  if (!origin) return false;
  if (allowedOrigins.includes(origin)) return true;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const hosts = [firstHeader(req.headers.host), firstHeader(req.headers["x-forwarded-host"])];
  return hosts.some((host) => host !== undefined && host.toLowerCase() === originHost.toLowerCase());
};

const rejectUpgrade = (socket: Duplex, status: string): void => {
  socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
};

const parseMessage = (data: RawData, isBinary: boolean) => {
  if (isBinary) return null;
  try {
    const result = clientMessageSchema.safeParse(JSON.parse(data.toString()));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
};

export const attachGameServer = (server: Server, options: GameServerOptions): GameServer => {
  const { allowedOrigins, tickIntervalMs = 1000, heartbeatIntervalMs = 30_000 } = options;
  const rooms = new RoomManager(options.rooms);
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });
  const alive = new WeakMap<WebSocket, boolean>();

  const onUpgrade = (req: IncomingMessage, socket: Duplex, head: Buffer): void => {
    const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
    if (pathname !== GAME_SOCKET_PATH) {
      rejectUpgrade(socket, "404 Not Found");
      return;
    }
    if (!isOriginAllowed(req, allowedOrigins)) {
      rejectUpgrade(socket, "403 Forbidden");
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  };
  server.on("upgrade", onUpgrade);

  wss.on("connection", (ws: WebSocket) => {
    alive.set(ws, true);
    let badMessages = 0;
    const connection: PlayerConnection = {
      send: (data) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(data);
      },
      close: (code, reason) => ws.close(code, reason),
    };

    ws.on("pong", () => alive.set(ws, true));
    ws.on("message", (data, isBinary) => {
      const message = parseMessage(data, isBinary);
      if (!message) {
        badMessages++;
        const error: ServerMessage = { type: "error", error: "bad_message" };
        connection.send(JSON.stringify(error));
        if (badMessages >= MAX_BAD_MESSAGES) ws.close(CLOSE_POLICY_VIOLATION, "bad_message");
        return;
      }
      badMessages = 0;
      rooms.handleMessage(connection, message);
    });
    ws.on("close", () => rooms.disconnect(connection));
    ws.on("error", () => ws.terminate());
  });

  const tickTimer = setInterval(() => rooms.tickAll(), tickIntervalMs);
  const heartbeatTimer = setInterval(() => {
    for (const ws of wss.clients) {
      if (!alive.get(ws)) {
        ws.terminate();
        continue;
      }
      alive.set(ws, false);
      ws.ping();
    }
  }, heartbeatIntervalMs);

  return {
    rooms,
    close: () =>
      new Promise<void>((resolve) => {
        clearInterval(tickTimer);
        clearInterval(heartbeatTimer);
        server.off("upgrade", onUpgrade);
        rooms.closeAll();
        for (const ws of wss.clients) ws.close(1001, "shutdown");
        wss.close(() => resolve());
      }),
  };
};
