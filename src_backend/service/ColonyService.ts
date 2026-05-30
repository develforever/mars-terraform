import { db } from "../data-source";
import { coloniesTable } from "../db/schema";
import { eq, and } from "drizzle-orm";
import type { ColonyData, ColonyResponse, SavedGameState } from "../model/types";

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
      state: JSON.parse(colonies[0].state) as SavedGameState,
    };
  }

  static async listColonies(userId: number): Promise<ColonyResponse[]> {
    const colonies = await db
      .select()
      .from(coloniesTable)
      .where(eq(coloniesTable.userId, userId));
    
    return colonies.map(c => ({
      ...c,
      state: JSON.parse(c.state) as SavedGameState,
    }));
  }

  static async deleteColony(userId: number, name: string): Promise<void> {
    await db
      .delete(coloniesTable)
      .where(and(eq(coloniesTable.userId, userId), eq(coloniesTable.name, name)));
  }
}
