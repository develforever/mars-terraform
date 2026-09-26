/** Kody 4xx dla błędów wywołanych przez klienta. Błędy infrastruktury zostają zwykłym `Error` (→ 5xx). */
export type HttpErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 429;

/**
 * Błąd biznesowy z kodem HTTP. Error handler z `app.ts` czyta `status`
 * i zwraca `{ error: message }` także w produkcji (komunikaty 4xx nie są ukrywane).
 */
export class HttpError extends Error {
  public readonly status: HttpErrorStatus;
  public override readonly name = "HttpError";

  constructor(status: HttpErrorStatus, message: string) {
    super(message);
    this.status = status;
  }
}
