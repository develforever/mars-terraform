import { readFileSync } from "fs";
import type { Request, RequestHandler, Response } from "express";

export interface HealthHandlerOptions {
  /** Sprawdzenie bazy (np. `select 1`); odrzucenie = baza niedostępna. */
  readonly checkDatabase: () => Promise<void>;
  /** Wersja aplikacji zwracana w odpowiedzi OK. */
  readonly version: string;
  /** Limit czasu sprawdzenia bazy w ms. */
  readonly timeoutMs: number;
}

export interface HealthOkBody {
  readonly status: "ok";
  readonly version: string;
}

export interface HealthDegradedBody {
  readonly status: "degraded";
  readonly database: "unavailable";
}

export const DATABASE_CHECK_TIMEOUT_MS = 2000;
export const UNKNOWN_VERSION = "unknown";

/**
 * Wyścig `promise` z timerem; timer jest zawsze czyszczony (brak wiszących uchwytów
 * po szybkiej odpowiedzi bazy).
 */
export const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Timed out after ${timeoutMs} ms`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
};

/**
 * `GET /api/health`: 200 `{ status: "ok", version }` gdy baza odpowiada w limicie czasu,
 * w przeciwnym razie 503 `{ status: "degraded", database: "unavailable" }`. Szczegóły błędu
 * wyłącznie w logu serwera. Odpowiedź nigdy nie jest cache'owana.
 */
export const createHealthHandler = (options: HealthHandlerOptions): RequestHandler => {
  const { checkDatabase, version, timeoutMs } = options;

  return async (_req: Request, res: Response): Promise<void> => {
    res.setHeader("Cache-Control", "no-store");
    try {
      await withTimeout(checkDatabase(), timeoutMs);
    } catch (error: unknown) {
      console.error("[health] database check failed:", error);
      const body: HealthDegradedBody = { status: "degraded", database: "unavailable" };
      res.status(503).json(body);
      return;
    }
    const body: HealthOkBody = { status: "ok", version };
    res.json(body);
  };
};

/**
 * Odczytuje pole `version` z `package.json`; brak pliku, zły JSON lub brak pola = `"unknown"`
 * (health check nie może zablokować startu serwera).
 */
export const readPackageVersion = (packageJsonPath: string): string => {
  try {
    const parsed: unknown = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    if (typeof parsed === "object" && parsed !== null && "version" in parsed) {
      const { version } = parsed;
      if (typeof version === "string" && version.trim().length > 0) {
        return version.trim();
      }
    }
    return UNKNOWN_VERSION;
  } catch {
    return UNKNOWN_VERSION;
  }
};
