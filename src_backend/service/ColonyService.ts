import { db } from "../data-source";
import { coloniesTable } from "../db/schema";
import { eq, and } from "drizzle-orm";

export interface ColonyData {
  name: string;
  state: any;
}

export class ColonyService {
  static async saveColony(userId: number, data: ColonyData) {
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
      return result.lastInsertRowid;
    }
  }

  static async getColony(userId: number, name: string) {
    const colonies = await db
      .select()
      .from(coloniesTable)
      .where(and(eq(coloniesTable.userId, userId), eq(coloniesTable.name, name)))
      .limit(1);

    if (colonies.length === 0) return null;

    return {
      ...colonies[0],
      state: JSON.parse(colonies[0].state),
    };
  }

  static async listColonies(userId: number) {
    const colonies = await db
      .select()
      .from(coloniesTable)
      .where(eq(coloniesTable.userId, userId));
    
    return colonies.map(c => ({
      ...c,
      state: JSON.parse(c.state)
    }));
  }
}
