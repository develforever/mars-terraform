import path from "path";
import { fileURLToPath } from "url";
import "./data-source";
import { config } from "./config";
import { createApp } from "./app";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = createApp({
  corsOrigins: config.corsOrigins,
  distPath: path.join(__dirname, "../dist"),
});

app.listen(config.port, "0.0.0.0", () => {
  console.log(`🚀 Backend running on http://0.0.0.0:${config.port}`);
});
