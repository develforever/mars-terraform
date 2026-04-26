import express from "express";
import "./data-source";
import { config } from "./config";
import { RegisterRoutes } from "./routes/routes";

const app = express();
app.use(express.json());

RegisterRoutes(app);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = (err as any).status ?? 500;
  res.status(status).json({ error: err.message });
});

app.listen(config.port, () => {
  console.log(`🚀 Backend running on http://localhost:${config.port}`);
});