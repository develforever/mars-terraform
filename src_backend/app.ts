import express, { type Express, type NextFunction, type Request, type Response } from "express";
import path from "path";
import { RegisterRoutes } from "./routes/routes";
import { createCorsMiddleware } from "./middleware/corsMiddleware";
import { createHealthHandler, DATABASE_CHECK_TIMEOUT_MS } from "./health";

export interface CreateAppOptions {
  /** Dozwolone originy CORS (dokładne dopasowanie). Pusta lista = CORS wyłączony. */
  readonly corsOrigins: readonly string[];
  /** Katalog zbudowanego frontendu (static + SPA fallback). Ignorowany, gdy `serveFrontend=false`. */
  readonly distPath: string;
  /** `false` = tryb API-only: bez static i SPA fallbacku, nieznane ścieżki → 404 JSON. */
  readonly serveFrontend: boolean;
  /** Sprawdzenie dostępności bazy dla `/api/health`. */
  readonly checkDatabase: () => Promise<void>;
  /** Wersja aplikacji zwracana przez `/api/health`. */
  readonly version: string;
  /** Produkcja: odpowiedzi 5xx bez szczegółów błędu (pełny błąd tylko w logu). */
  readonly isProduction: boolean;
  /** Limit czasu sprawdzenia bazy w ms (domyślnie {@link DATABASE_CHECK_TIMEOUT_MS}). */
  readonly databaseCheckTimeoutMs?: number;
}

interface ErrorBody {
  readonly error: string;
  readonly fields?: unknown;
}

const NOT_FOUND_BODY: ErrorBody = { error: "Not Found" };
const INTERNAL_ERROR_MESSAGE = "Internal Server Error";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isHttpStatus = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 400 && value <= 599;

/** Status z `status`/`statusCode` błędu (TSOA auth → 401, `ValidateError` → 400, body-parser → 400). */
const resolveStatus = (err: unknown): number => {
  if (!isRecord(err)) {
    return 500;
  }
  if (isHttpStatus(err.status)) {
    return err.status;
  }
  if (isHttpStatus(err.statusCode)) {
    return err.statusCode;
  }
  return 500;
};

const resolveMessage = (err: unknown): string => {
  if (err instanceof Error) {
    return err.message;
  }
  if (isRecord(err) && typeof err.message === "string") {
    return err.message;
  }
  return String(err);
};

/**
 * Treść odpowiedzi błędu. 4xx: komunikat jak dotąd + `fields` z TSOA `ValidateError`
 * (wcześniej gubione — `ValidateError` ma zwykle pusty `message`). 5xx w produkcji: ogólny komunikat.
 */
const buildErrorBody = (err: unknown, status: number, isProduction: boolean): ErrorBody => {
  if (status >= 500 && isProduction) {
    return { error: INTERNAL_ERROR_MESSAGE };
  }
  const message = resolveMessage(err);
  if (status < 500 && isRecord(err) && isRecord(err.fields)) {
    return { error: message, fields: err.fields };
  }
  return { error: message };
};

export const createApp = (options: CreateAppOptions): Express => {
  const {
    corsOrigins,
    distPath,
    serveFrontend,
    checkDatabase,
    version,
    isProduction,
    databaseCheckTimeoutMs = DATABASE_CHECK_TIMEOUT_MS,
  } = options;

  const app = express();
  app.use(createCorsMiddleware(corsOrigins));
  app.use(express.json());

  app.get("/api/health", createHealthHandler({ checkDatabase, version, timeoutMs: databaseCheckTimeoutMs }));

  RegisterRoutes(app);

  if (serveFrontend) {
    app.use(express.static(distPath));

    app.use((req: Request, res: Response, next: NextFunction): void => {
      if (req.path === "/api" || req.path.startsWith("/api/")) {
        next();
        return;
      }
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.use((_req: Request, res: Response): void => {
    res.status(404).json(NOT_FOUND_BODY);
  });

  app.use((err: unknown, _req: Request, res: Response, next: NextFunction): void => {
    if (res.headersSent) {
      next(err);
      return;
    }
    const status = resolveStatus(err);
    if (status >= 500) {
      console.error("[app] unhandled error:", err);
    }
    res.status(status).json(buildErrorBody(err, status, isProduction));
  });

  return app;
};
