import express, { type Express } from "express";
import path from "path";
import { RegisterRoutes } from "./routes/routes";
import { createCorsMiddleware } from "./middleware/corsMiddleware";

export interface CreateAppOptions {
  /** Dozwolone originy CORS (dokładne dopasowanie). Pusta lista = CORS wyłączony. */
  readonly corsOrigins: readonly string[];
  /** Katalog zbudowanego frontendu (static + SPA fallback). */
  readonly distPath: string;
}

export const createApp = (options: CreateAppOptions): Express => {
  const { corsOrigins, distPath } = options;

  const app = express();
  app.use(createCorsMiddleware(corsOrigins));
  app.use(express.json());

  RegisterRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use(express.static(distPath));

  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) {
      return next();
    }
    res.sendFile(path.join(distPath, "index.html"));
  });

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    void _next;
    const status = (err as { status?: number }).status ?? 500;
    res.status(status).json({ error: err.message });
  });

  return app;
};
