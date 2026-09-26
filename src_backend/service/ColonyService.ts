import { db } from "../data-source";
import { coloniesTable } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import type { ColonyData, ColonyResponse, ColonyState, ColonySummary } from "../model/types";

export class ColonyService {
  static async saveColony(userId: number, data: ColonyData): Promise<number> {
    const existing = await db
      .select()
      .from(coloniesTable)
      .where(and(eq(coloniesTable.userId, userId), eq(coloniesTable.name, data.name)))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(coloniesTable)
        .set({
          state: JSON.stringify(data.state),
          updatedAt: new Date(),
        })
        .where(eq(coloniesTable.id, existing[0].id));
      return existing[0].id;
    } else {
      const result = await db.insert(coloniesTable).values({
        userId,
        name: data.name,
        state: JSON.stringify(data.state),
      });
      return Number(result.lastInsertRowid);
    }
  }

  static async getColony(userId: number, name: string): Promise<ColonyResponse | null> {
    const colonies = await db
      .select()
      .from(coloniesTable)
      .where(and(eq(coloniesTable.userId, userId), eq(coloniesTable.name, name)))
      .limit(1);

    if (colonies.length === 0) return null;

    return {
      ...colonies[0],
      state: JSON.parse(colonies[0].state) as ColonyState,
    };
  }

  /**
   * Lekka lista (D14): SELECT tylko `id`, `name`, `created_at`, `updated_at` (bez kolumny `state`,
   * bez `JSON.parse`). Kolejność: `updatedAt` malejąco, remis rozstrzyga `id` malejąco.
   */
  static async listColonies(userId: number): Promise<ColonySummary[]> {
    const rows = await db
      .select({
        id: coloniesTable.id,
        name: coloniesTable.name,
        createdAt: coloniesTable.createdAt,
        updatedAt: coloniesTable.updatedAt,
      })
      .from(coloniesTable)
      .where(eq(coloniesTable.userId, userId))
      .orderBy(desc(coloniesTable.updatedAt), desc(coloniesTable.id));

    return rows.map((row): ColonySummary => ({
      id: row.id,
      name: row.name,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  static async deleteColony(userId: number, name: string): Promise<void> {
    await db
      .delete(coloniesTable)
      .where(and(eq(coloniesTable.userId, userId), eq(coloniesTable.name, name)));
  }
}
