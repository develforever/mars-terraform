import { db } from "../data-source";
import { mapsTable } from "../db/schema";
import { eq, and } from "drizzle-orm";
import type { SaveMapDTO, MapSummaryResponse, MapDetailResponse } from "../model/mapTypes";

export class MapService {
  static async saveMap(userId: number, dto: SaveMapDTO): Promise<MapDetailResponse> {
    const description = dto.description ?? null;
    const players = dto.players ?? 2;
    const version = dto.version ?? "2.0";

    if (dto.id !== undefined) {
      const existing = await db
        .select()
        .from(mapsTable)
        .where(and(eq(mapsTable.id, dto.id), eq(mapsTable.userId, userId)))
        .limit(1);

      if (existing.length === 0) {
        throw new Error("Map not found or unauthorized");
      }

      await db
        .update(mapsTable)
        .set({
          name: dto.name,
          description,
          players,
          version,
          data: dto.data,
          updatedAt: new Date(),
        })
        .where(eq(mapsTable.id, dto.id));

      const updated = await db
        .select()
        .from(mapsTable)
        .where(eq(mapsTable.id, dto.id))
        .limit(1);

      return updated[0];
    } else {
      const result = await db.insert(mapsTable).values({
        userId,
        name: dto.name,
        description,
        players,
        version,
        data: dto.data,
      });
      const insertedId = Number(result.lastInsertRowid);

      const inserted = await db
        .select()
        .from(mapsTable)
        .where(eq(mapsTable.id, insertedId))
        .limit(1);

      return inserted[0];
    }
  }

  static async getMap(userId: number, id: number): Promise<MapDetailResponse | null> {
    const maps = await db
      .select()
      .from(mapsTable)
      .where(and(eq(mapsTable.id, id), eq(mapsTable.userId, userId)))
      .limit(1);

    if (maps.length === 0) return null;
    return maps[0];
  }

  static async listMaps(userId: number): Promise<MapSummaryResponse[]> {
    const maps = await db
      .select({
        id: mapsTable.id,
        userId: mapsTable.userId,
        name: mapsTable.name,
        description: mapsTable.description,
        players: mapsTable.players,
        version: mapsTable.version,
        createdAt: mapsTable.createdAt,
        updatedAt: mapsTable.updatedAt,
      })
      .from(mapsTable)
      .where(eq(mapsTable.userId, userId));

    return maps;
  }

  static async deleteMap(userId: number, id: number): Promise<boolean> {
    const existing = await db
      .select()
      .from(mapsTable)
      .where(and(eq(mapsTable.id, id), eq(mapsTable.userId, userId)))
      .limit(1);

    if (existing.length === 0) {
      return false;
    }

    await db
      .delete(mapsTable)
      .where(and(eq(mapsTable.id, id), eq(mapsTable.userId, userId)));

    return true;
  }
}
