import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./db/schema";
import { config } from "./config";

export const db = drizzle({
  connection: {
    url: config.tursoUrl,
    authToken: config.tursoToken,
  },
  schema,
});