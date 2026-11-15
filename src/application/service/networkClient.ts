import { GAME_SOCKET_PATH, type ClientMessage, type ServerMessage } from "../../domain/network/NetworkProtocol";

/**
 * Klient WebSocket gry sieciowej (F9-T5). Łączy się z serwerem gry na tym samym originie (D3),
 * kolejkuje wiadomości do otwarcia połączenia i po zerwaniu próbuje połączyć się ponownie.
 * Co zrobić po ponownym połączeniu (np. ponowne dołączenie do pokoju), decyduje wywołujący (`onOpen`).
 */

/** Podzbiór `WebSocket` przeglądarki używany przez klienta (podmieniany w testach). */
export interface SocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
}

export type SocketFactory = (url: string) => SocketLike;

export interface GameSocketHandlers {
  /** Połączenie otwarte; `reconnected` = po zerwaniu (trzeba ponownie dołączyć do pokoju). */
  onOpen(reconnected: boolean): void;
  onMessage(message: ServerMessage): void;
  /** Połączenie zerwane, trwa ponowna próba. */
  onReconnecting(attempt: number): void;
  /** Połączenie zerwane na stałe (wyczerpane próby albo serwer odrzucił klienta). */
  onConnectionLost(): void;
}

export interface GameSocketOptions {
  readonly createSocket?: SocketFactory;
  /** Odstępy kolejnych prób ponownego połączenia; ich liczba = liczba prób. */
  readonly retryDelaysMs?: readonly number[];
}

const OPEN = 1;
/** Kody zamknięcia, po których nie ma sensu łączyć się ponownie (naruszenie zasad, limit prób dołączenia). */
const NO_RETRY_CLOSE_CODES: ReadonlySet<number> = new Set([1008, 4001]);
export const DEFAULT_RETRY_DELAYS_MS: readonly number[] = [1000, 2000, 4000, 8000, 8000];

/** Adres WebSocket serwera gry dla bieżącej strony (`wss` na https, np. przez tunel). */
export const gameSocketUrl = (location: Pick<Location, "protocol" | "host">): string =>
  `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}${GAME_SOCKET_PATH}`;

/** Link zaproszenia: strona startowa gospodarza z kodem pokoju (otwiera okno dołączenia). */
export const inviteLink = (origin: string, code: string): string => `${origin}/?join=${encodeURIComponent(code)}`;

const isServerMessage =(value: unknown): value is ServerMessage =>
  typeof value === "object" && value !== null && typeof (value as { type?: unknown }).type === "string";

export class GameSocketClient {
  private socket: SocketLike | null = null;
  private queue: string[] = [];
  private attempt = 0;
  private hasOpened = false;
  private closedByUser = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly url: string;
  private readonly handlers: GameSocketHandlers;
  private readonly createSocket: SocketFactory;
  private readonly retryDelaysMs: readonly number[];

  constructor(url: string, handlers: GameSocketHandlers, options: GameSocketOptions = {}) {
    this.url = url;
    this.handlers = handlers;
    this.createSocket = options.createSocket ?? ((socketUrl) => new WebSocket(socketUrl));
    this.retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  }

  connect(): void {
    this.closedByUser = false;
    this.open();
  }

  /** Wysyła od razu albo po (ponownym) otwarciu połączenia, za wiadomościami z `onOpen`. */
  send(message: ClientMessage): void {
    const data = JSON.stringify(message);
    if (this.socket?.readyState === OPEN) {
      this.socket.send(data);
    } else {
      this.queue.push(data);
    }
  }

  /** Zamknięcie z inicjatywy gracza: bez ponownych prób. */
  close(): void {
    this.closedByUser = true;
    this.queue = [];
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.onclose = null;
      socket.close(1000, "leave");
    }
  }

  private open(): void {
    const socket = this.createSocket(this.url);
    this.socket = socket;

    socket.onopen = () => {
      const reconnected = this.hasOpened;
      this.hasOpened = true;
      this.attempt = 0;
      const pending = this.queue;
      this.queue = [];
      this.handlers.onOpen(reconnected);
      for (const data of pending) socket.send(data);
    };

    socket.onmessage = (event: MessageEvent) => {
      if (typeof event.data !== "string") return;
      try {
        const message: unknown = JSON.parse(event.data);
        if (isServerMessage(message)) this.handlers.onMessage(message);
      } catch {
        // Uszkodzona wiadomość od serwera: pomijamy.
      }
    };

    socket.onerror = () => {
      // Szczegóły są w `onclose`, który przeglądarka wywołuje zaraz po błędzie.
    };

    socket.onclose = (event: CloseEvent) => {
      this.socket = null;
      if (this.closedByUser) return;
      if (NO_RETRY_CLOSE_CODES.has(event.code) || this.attempt >= this.retryDelaysMs.length) {
        this.handlers.onConnectionLost();
        return;
      }
      const delay = this.retryDelaysMs[this.attempt];
      this.attempt += 1;
      this.handlers.onReconnecting(this.attempt);
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        if (!this.closedByUser) this.open();
      }, delay);
    };
  }
}

/**
 * Serwer gry jest dostępny, gdy strona jest serwowana przez serwer Node (D3): `/api/health` zwraca JSON
 * `{ status: "ok" }`. Na statycznym hostingu (tylko gra solo) zwraca 404 albo stronę HTML.
 */
export const checkGameServerAvailable = async (fetchFn: typeof fetch = fetch): Promise<boolean> => {
  try {
    const response = await fetchFn("/api/health", { headers: { Accept: "application/json" } });
    if (!response.ok) return false;
    const body: unknown = await response.json();
    return typeof body === "object" && body !== null && (body as { status?: unknown }).status === "ok";
  } catch {
    return false;
  }
};
