import dotenv from "dotenv-flow";
dotenv.config();

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./src_backend/db/schema.ts",
  dialect: "turso",
  dbCredentials: {
    url: process.env.turso_url ?? "",
    authToken: process.env.turso_token ?? "",
  },
});
