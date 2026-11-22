import type { ClientMessage, ServerMessage } from "../../../domain/network/NetworkProtocol";
import type { SocketFactory, SocketLike } from "../networkClient";

/** Gniazdo testowe: zapisuje wysłane wiadomości, test steruje otwarciem, odpowiedziami i zamknięciem. */
export class FakeSocket implements SocketLike {
  readyState = 0;
  readonly sent: ClientMessage[] = [];
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  closedWith: number | null = null;
  readonly url: string;

  constructor(url: string) {
    this.url = url;
  }

  send(data: string): void {
    this.sent.push(JSON.parse(data) as ClientMessage);
  }

  close(code = 1000): void {
    this.closedWith = code;
    this.readyState = 3;
  }

  open(): void {
    this.readyState = 1;
    this.onopen?.(new Event("open"));
  }

  receive(message: ServerMessage | string): void {
    this.onmessage?.(new MessageEvent("message", { data: typeof message === "string" ? message : JSON.stringify(message) }));
  }

  /** Zamknięcie od strony serwera / sieci. */
  drop(code = 1006): void {
    this.readyState = 3;
    this.onclose?.(new CloseEvent("close", { code }));
  }
}

export const fakeSocketFactory = () => {
  const sockets: FakeSocket[] = [];
  const createSocket: SocketFactory = (url) => {
    const socket = new FakeSocket(url);
    sockets.push(socket);
    return socket;
  };
  return { sockets, createSocket, last: () => sockets[sockets.length - 1] };
};
