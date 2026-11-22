import path from "path";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { createCorsMiddleware } from "./middleware/corsMiddleware";
import { securityHeaders, staticCacheControl } from "./middleware/securityHeaders";
import { createHealthHandler, READINESS_CHECK_TIMEOUT_MS } from "./health";

export interface CreateAppOptions {
  /** Dozwolone originy CORS (dokładne dopasowanie). Pusta lista = CORS wyłączony. */
  readonly corsOrigins: readonly string[];
  /** Katalog zbudowanego frontendu (static + SPA fallback). Ignorowany, gdy `serveFrontend=false`. */
  readonly distPath: string;
  /** `false` = tryb API-only: bez static i SPA fallbacku, nieznane ścieżki → 404 JSON. */
  readonly serveFrontend: boolean;
  /** Opcjonalne sprawdzenie gotowości dla `/api/health` (T15: brak bazy, domyślnie brak). */
  readonly checkReadiness?: () => Promise<void>;
  /** Wersja aplikacji zwracana przez `/api/health`. */
  readonly version: string;
  /** Produkcja: odpowiedzi 5xx bez szczegółów błędu (pełny błąd tylko w logu). */
  readonly isProduction: boolean;
  /** Limit czasu sprawdzenia gotowości w ms (domyślnie {@link READINESS_CHECK_TIMEOUT_MS}). */
  readonly readinessTimeoutMs?: number;
  /**
   * Rejestracja tras API (po `/api/health`, przed 404 i obsługą błędów). T15: serwer nie ma jeszcze
   * własnych tras; punkt rozszerzenia dla przyszłej logiki gry na serwerze.
   */
  readonly registerRoutes?: (app: Express) => void;
}

interface ErrorBody {
  readonly error: string;
  readonly fields?: unknown;
}

const NOT_FOUND_BODY: ErrorBody = { error: "Not Found" };
const PAYLOAD_TOO_LARGE_BODY: ErrorBody = { error: "Payload Too Large" };

/**
 * Limit ciała JSON (`express.json`). T15: serwer nie przyjmuje zapisów gry ani map (są w przeglądarce),
 * więc wystarcza mały limit. Przekroczenie → 413 `{ error: "Payload Too Large" }`.
 */
export const JSON_BODY_LIMIT_BYTES = 64 * 1024;
const INTERNAL_ERROR_MESSAGE = "Internal Server Error";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isHttpStatus = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 400 && value <= 599;

/** Status z `status`/`statusCode` błędu (`HttpError`, body-parser → 400/413). */
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
 * Treść odpowiedzi błędu. 4xx: komunikat (+ `fields`, jeśli błąd walidacji je ma). 5xx w produkcji: ogólny komunikat.
 */
const buildErrorBody = (err: unknown, status: number, isProduction: boolean): ErrorBody => {
  if (status >= 500 && isProduction) {
    return { error: INTERNAL_ERROR_MESSAGE };
  }
  if (status === 413) {
    return PAYLOAD_TOO_LARGE_BODY;
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
    checkReadiness,
    version,
    isProduction,
    readinessTimeoutMs = READINESS_CHECK_TIMEOUT_MS,
    registerRoutes,
  } = options;

  const app = express();
  app.disable("x-powered-by");
  app.use(securityHeaders);
  app.use(createCorsMiddleware(corsOrigins));
  app.use(express.json({ limit: JSON_BODY_LIMIT_BYTES }));

  app.get("/api/health", createHealthHandler({ checkReadiness, version, timeoutMs: readinessTimeoutMs }));

  registerRoutes?.(app);

  if (serveFrontend) {
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          res.setHeader("Cache-Control", staticCacheControl(path.relative(distPath, filePath)));
        },
      }),
    );

    app.use((req: Request, res: Response, next: NextFunction): void => {
      if (req.path === "/api" || req.path.startsWith("/api/")) {
        next();
        return;
      }
      // `root` zamiast pełnej ścieżki: katalog z kropką w ścieżce (np. `.claude/…`) nie jest traktowany jak plik ukryty.
      res.setHeader("Cache-Control", staticCacheControl("index.html"));
      res.sendFile("index.html", { root: distPath });
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
