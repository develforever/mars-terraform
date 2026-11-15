import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config";
import { createApp } from "./app";
import { readPackageVersion } from "./health";
import { attachGameServer } from "./game/gameServer";

/**
 * Minimalny serwer (T15, D18): bez kont, bazy i zapisów (gra działa w przeglądarce).
 * F9-T4 (D3): ten sam proces obsługuje grę sieciową (WebSocket `/ws`, pokoje w pamięci).
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = createApp({
  corsOrigins: config.corsOrigins,
  distPath: path.join(__dirname, "../dist"),
  serveFrontend: config.serveFrontend,
  version: readPackageVersion(path.join(__dirname, "../package.json")),
  isProduction: config.isProduction,
});

const server = app.listen(config.port, "0.0.0.0", () => {
  console.log(`🚀 Backend running on http://0.0.0.0:${config.port}`);
});

attachGameServer(server, { allowedOrigins: config.corsOrigins });
