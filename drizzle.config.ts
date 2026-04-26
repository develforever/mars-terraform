import { config } from "./src_backend/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./src_backend/db/schema.ts",
  dialect: "turso",
  dbCredentials: {
    url: config.tursoUrl,
    authToken: config.tursoToken,
  },
});
