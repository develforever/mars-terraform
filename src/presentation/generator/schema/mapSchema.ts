/**
 * mapSchema.ts
 *
 * Zod — walidacja KSZTALTU pliku mapy przy imporcie (kontrakt v2.0).
 * Sluzy tez jako stabilny kontrakt dla przyszlego agenta AI.
 * (Reguly gry — spawny vs gracze itd. — sprawdza osobno validateMap.)
 */

import { z } from 'zod'

const tuple2 = z.tuple([z.number(), z.number()])

export const terrainTypeSchema  = z.enum(['deep_crater', 'lowland', 'plains', 'highland', 'rocky', 'peak'])
export const userTypeSchema     = z.enum(['empty', 'build', 'resource', 'spawn'])
export const buildingTypeSchema = z.enum(['colony', 'oxygen_generator', 'greenhouse', 'solar_power', 'extractor'])
export const resourceTypeSchema = z.enum(['minerals', 'ice', 'organics', 'energy'])
export const richnessSchema     = z.enum(['low', 'med', 'high'])

const hexCellSchema = z.object({
  q: z.number(),
  r: z.number(),
  terrainType: terrainTypeSchema,
  userType: userTypeSchema.nullable(),
  decor: z.string().nullable(),
})

const buildNodeSchema = z.object({
  id: z.string(),
  pos: tuple2,
  footprint: tuple2,
  allowedTypes: z.array(buildingTypeSchema),
})

const resourceNodeSchema = z.object({
  id: z.string(),
  type: resourceTypeSchema,
  pos: tuple2,
  amount: z.number(),
  richness: richnessSchema,
  model: z.string(),
})

const spawnPointSchema = z.object({
  player: z.number().int().min(1).max(4),
  pos: tuple2,
})

const decorItemSchema = z.object({
  model: z.string(),
  pos: tuple2,
  rot: z.number(),
  scale: z.number(),
})

export const mapExportSchema = z.object({
  meta: z.object({
    name: z.string(),
    description: z.string(),
    version: z.literal('2.0'),
    gridType: z.literal('hex-flat-top'),
    hexSize: z.number(),
    hexRadius: z.number().int().min(1).max(60),
    players: z.number().int().min(1).max(4),
    seed: z.number(),
  }),
  hexes: z.array(hexCellSchema),
  buildNodes: z.array(buildNodeSchema),
  resourceNodes: z.array(resourceNodeSchema),
  spawnPoints: z.array(spawnPointSchema),
  decor: z.array(decorItemSchema),
})

export type MapExportParsed = z.infer<typeof mapExportSchema>

export interface ParseResult {
  ok: boolean
  data?: MapExportParsed
  error?: string
}

/** Bezpieczny parse — zwraca dane albo czytelny komunikat bledu. */
export function parseMapJSON(input: unknown): ParseResult {
  const res = mapExportSchema.safeParse(input)
  if (res.success) return { ok: true, data: res.data }
  const issues = res.error.issues.slice(0, 6).map(i => {
    const path = i.path.length ? i.path.join('.') : '(root)'
    return `${path}: ${i.message}`
  })
  return { ok: false, error: issues.join('\n') }
}
