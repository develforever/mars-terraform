import type { NextFunction, Request, RequestHandler, Response } from "express";

export const CORS_ALLOWED_METHODS = "GET,POST,PUT,PATCH,DELETE,OPTIONS";
export const CORS_ALLOWED_HEADERS = "Authorization, Content-Type";
export const CORS_MAX_AGE_SECONDS = "600";

const isPreflight = (req: Request): boolean =>
  req.method === "OPTIONS" && req.headers["access-control-request-method"] !== undefined;

/**
 * CORS z dokładną allowlistą originów (bez wildcardów, bez odbijania dowolnego originu,
 * bez `Access-Control-Allow-Credentials` — auth idzie przez `Authorization: Bearer`).
 * Pusta lista = no-op (monolit same-origin). Przy niepustej liście `Vary: Origin` trafia na KAŻDĄ
 * odpowiedź (także bez `Origin` i z niedozwolonym originem), żeby współdzielony cache nie podał
 * odpowiedzi z nagłówkami CORS innemu originowi.
 */
export const createCorsMiddleware = (allowedOrigins: readonly string[]): RequestHandler => {
  const allowed = new Set<string>(allowedOrigins);

  return (req: Request, res: Response, next: NextFunction): void => {
    if (allowed.size === 0) {
      next();
      return;
    }

    res.vary("Origin");

    const origin = req.headers.origin;
    if (origin === undefined) {
      next();
      return;
    }

    if (!allowed.has(origin)) {
      if (isPreflight(req)) {
        res.status(403).end();
        return;
      }
      next();
      return;
    }

    res.setHeader("Access-Control-Allow-Origin", origin);

    if (isPreflight(req)) {
      res.setHeader("Access-Control-Allow-Methods", CORS_ALLOWED_METHODS);
      res.setHeader("Access-Control-Allow-Headers", CORS_ALLOWED_HEADERS);
      res.setHeader("Access-Control-Max-Age", CORS_MAX_AGE_SECONDS);
      res.status(204).end();
      return;
    }

    next();
  };
};
