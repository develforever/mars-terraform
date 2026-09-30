import { int, sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Konta graczy bez danych osobowych (T13, D17): brak e-maila, imienia i hasła.
 * Logowanie numerem konta; w bazie tylko jego HMAC (`account_hash`). Opcjonalny TOTP (sekret zaszyfrowany).
 */
export const usersTable = sqliteTable("users", {
  id: int().primaryKey({ autoIncrement: true }),
  accountHash: text("account_hash").notNull().unique(),
  nickname: text(),
  totpSecret: text("totp_secret"),
  totpEnabled: integer("totp_enabled", { mode: "boolean" }).notNull().default(false),
  totpLastStep: integer("totp_last_step"),
  lastLoginAt: integer("last_login_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const groupsTable = sqliteTable("groups", {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull().unique(),
  description: text(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const userGroupsTable = sqliteTable("user_groups", {
  userId: int("user_id")
    .notNull()
    .references(() => usersTable.id),
  groupId: int("group_id")
    .notNull()
    .references(() => groupsTable.id),
}, (table) => [
  primaryKey({ columns: [table.userId, table.groupId] }),
]);

export const coloniesTable = sqliteTable("colonies", {
  id: int().primaryKey({ autoIncrement: true }),
  userId: int("user_id")
    .notNull()
    .references(() => usersTable.id),
  name: text().notNull(),
  state: text().notNull(), // JSON string representing the game state
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const mapsTable = sqliteTable("maps", {
  id: int().primaryKey({ autoIncrement: true }),
  userId: int("user_id")
    .notNull()
    .references(() => usersTable.id),
  name: text().notNull(),
  description: text(),
  players: int().notNull().default(2),
  version: text().notNull().default("2.0"),
  data: text().notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

