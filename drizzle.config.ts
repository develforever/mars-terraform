import dotenv from "dotenv-flow";
dotenv.config();

import { defineConfig } from "drizzle-kit";

const tursoUrl = process.env.turso_url;
const isTurso = !!(tursoUrl && tursoUrl.startsWith("libsql"));

export default defineConfig(
  isTurso
    ? {
        out: "./drizzle",
        schema: "./src_backend/db/schema.ts",
        dialect: "turso",
        dbCredentials: {
          url: tursoUrl!,
          authToken: process.env.turso_token ?? "",
        },
      }
    : {
        out: "./drizzle",
        schema: "./src_backend/db/schema.ts",
        dialect: "sqlite",
        dbCredentials: {
          url: tursoUrl ?? "file:./local.db",
        },
      },
);
