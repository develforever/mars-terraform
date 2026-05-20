import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import "./data-source";
import { config } from "./config";
import { RegisterRoutes } from "./routes/routes";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

RegisterRoutes(app);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

const distPath = path.join(__dirname, "../dist");
app.use(express.static(distPath));

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return next();
  }
  res.sendFile(path.join(distPath, "index.html"));
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = (err as any).status ?? 500;
  res.status(status).json({ error: err.message });
});

app.listen(config.port, "0.0.0.0", () => {
  console.log(`🚀 Backend running on http://0.0.0.0:${config.port}`);
});