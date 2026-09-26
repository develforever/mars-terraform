import path from "path";
import { fileURLToPath } from "url";
import { sql } from "drizzle-orm";
import { db } from "./data-source";
import { config } from "./config";
import { createApp } from "./app";
import { readPackageVersion } from "./health";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = createApp({
  corsOrigins: config.corsOrigins,
  distPath: path.join(__dirname, "../dist"),
  serveFrontend: config.serveFrontend,
  checkDatabase: async (): Promise<void> => {
    await db.run(sql`select 1`);
  },
  version: readPackageVersion(path.join(__dirname, "../package.json")),
  isProduction: config.isProduction,
});

app.listen(config.port, "0.0.0.0", () => {
  console.log(`🚀 Backend running on http://0.0.0.0:${config.port}`);
});
