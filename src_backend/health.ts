import { readFileSync } from "fs";
import type { Request, RequestHandler, Response } from "express";

export interface HealthHandlerOptions {
  /**
   * Opcjonalne sprawdzenie zależności (np. przyszły magazyn stanu gry); odrzucenie = 503.
   * T15: serwer nie ma bazy, więc domyślnie brak sprawdzenia i zawsze 200.
   */
  readonly checkReadiness?: () => Promise<void>;
  /** Wersja aplikacji zwracana w odpowiedzi OK. */
  readonly version: string;
  /** Limit czasu sprawdzenia gotowości w ms. */
  readonly timeoutMs: number;
}

export interface HealthOkBody {
  readonly status: "ok";
  readonly version: string;
}

export interface HealthDegradedBody {
  readonly status: "degraded";
}

export const READINESS_CHECK_TIMEOUT_MS = 2000;
export const UNKNOWN_VERSION = "unknown";

/**
 * Wyścig `promise` z timerem; timer jest zawsze czyszczony (brak wiszących uchwytów
 * po szybkiej odpowiedzi).
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
 * `GET /api/health`: 200 `{ status: "ok", version }`; gdy podano `checkReadiness` i nie powiedzie się
 * w limicie czasu, 503 `{ status: "degraded" }`. Szczegóły błędu wyłącznie w logu serwera.
 * Odpowiedź nigdy nie jest cache'owana.
 */
export const createHealthHandler = (options: HealthHandlerOptions): RequestHandler => {
  const { checkReadiness, version, timeoutMs } = options;

  return async (_req: Request, res: Response): Promise<void> => {
    res.setHeader("Cache-Control", "no-store");
    try {
      if (checkReadiness) await withTimeout(checkReadiness(), timeoutMs);
    } catch (error: unknown) {
      console.error("[health] readiness check failed:", error);
      const body: HealthDegradedBody = { status: "degraded" };
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
