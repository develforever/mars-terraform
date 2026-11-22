import type { NextFunction, Request, Response } from "express";

/**
 * Nagłówki bezpieczeństwa serwera gry (F9-T6). Po D19 nie ma `vercel.json`, więc ustawia je serwer, który gospodarz
 * uruchamia u siebie (D3). Polityka jak dawna produkcyjna (T16), z jedną zmianą: `connect-src 'self'` obejmuje
 * też WebSocket `/ws` tego samego hosta (CSP3 dopasowuje `'self'` do `ws:`/`wss:`), więc nic więcej nie potrzeba.
 *
 * Bez `Strict-Transport-Security`: serwer gospodarza działa po HTTP (localhost / LAN), a HTTPS daje tunel,
 * który sam decyduje o HSTS. Wysłanie HSTS z serwera, który nie kontroluje TLS, mogłoby zablokować dostęp.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  // Dekoder three.js (Draco/Basis) kompiluje WebAssembly.
  "script-src 'self' 'wasm-unsafe-eval'",
  // React i drei ustawiają style inline.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // `blob:`/`data:` dla zasobów osadzonych w GLB; WebSocket gry = `'self'`.
  "connect-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "media-src 'self' blob: data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

export const SECURITY_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  "Content-Security-Policy": CONTENT_SECURITY_POLICY,
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Cross-Origin-Opener-Policy": "same-origin",
});

export const securityHeaders = (_req: Request, res: Response, next: NextFunction): void => {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    res.setHeader(name, value);
  }
  next();
};

/**
 * `Cache-Control` dla pliku frontendu (ścieżka względem katalogu `dist`). Pliki z hashem w nazwie (`assets/…`)
 * są niezmienne; modele i tekstury - dzień; reszta (w tym `index.html`) zawsze sprawdzana.
 */
export const staticCacheControl = (relativePath: string): string => {
  const normalized = relativePath.replace(/\\/g, "/");
  if (normalized.startsWith("assets/")) return "public, max-age=31536000, immutable";
  if (/^(models|textures|icons)\//.test(normalized)) return "public, max-age=86400, stale-while-revalidate=604800";
  return "no-cache";
};
