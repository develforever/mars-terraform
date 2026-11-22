import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config";
import { createApp } from "./app";
import { readPackageVersion } from "./health";
import { attachGameServer } from "./game/gameServer";
import { frontendBuilt, hostBanner, lanAddresses, portInUse, portInUseMessage } from "./hostInfo";

/**
 * Minimalny serwer (T15, D18): bez kont, bazy i zapisów (gra działa w przeglądarce).
 * F9-T4 (D3): ten sam proces obsługuje grę sieciową (WebSocket `/ws`, pokoje w pamięci).
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPath = path.join(__dirname, "../dist");

const app = createApp({
  corsOrigins: config.corsOrigins,
  distPath,
  serveFrontend: config.serveFrontend,
  version: readPackageVersion(path.join(__dirname, "../package.json")),
  isProduction: config.isProduction,
});

if (await portInUse(config.port)) {
  console.error(portInUseMessage(config.port));
  process.exit(1);
}

const server = app.listen(config.port, "0.0.0.0", () => {
  const banner = hostBanner({
    port: config.port,
    addresses: lanAddresses(),
    serveFrontend: config.serveFrontend,
    frontendBuilt: frontendBuilt(distPath),
  });
  console.log(banner.join("\n"));
});

attachGameServer(server, { allowedOrigins: config.corsOrigins });
