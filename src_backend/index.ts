import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config";
import { createApp } from "./app";
import { readPackageVersion } from "./health";

/**
 * Minimalny serwer (T15, D18): bez kont, bazy i zapisów (gra działa w przeglądarce).
 * Baza pod przyszłą fazę logiki gry na serwerze: CORS, `/api/health`, obsługa błędów.
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

app.listen(config.port, "0.0.0.0", () => {
  console.log(`🚀 Backend running on http://0.0.0.0:${config.port}`);
});
