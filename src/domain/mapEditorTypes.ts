// ─── Building & Resource types ───────────────────────────────────────────────

export type BuildingType =
  | 'colony'
  | 'oxygen_generator'
  | 'greenhouse'
  | 'solar_power'
  | 'extractor'

export type ResourceType = 'minerals' | 'ice' | 'organics' | 'energy'

export type TileType = 'empty' | 'build' | 'resource' | 'blocked' | 'spawn'

export type ToolMode = 'build' | 'resource' | 'blocked' | 'spawn' | 'erase' | 'select'

export type BrushSize = 1 | 3 | 5

export type Richness = 'low' | 'med' | 'high'

// ─── Map entities ─────────────────────────────────────────────────────────────

export interface MapMeta {
  name: string
  description: string
  size: [number, number]
  tileSize: number
  players: number
  terrainFile: string
  seed: number | null
}

export interface BuildNode {
  id: string
  pos: [number, number]
  footprint: [number, number]
  allowedTypes: BuildingType[]
}

export interface ResourceNode {
  id: string
  type: ResourceType
  pos: [number, number]
  amount: number
  richness: Richness
  model: string
}

export interface SpawnPoint {
  player: number
  pos: [number, number]
}

export interface DecorItem {
  model: string
  pos: [number, number]
  rot: number
  scale: number
}

// ─── Export schema ────────────────────────────────────────────────────────────

export interface MapExportJSON {
  meta: MapMeta
  buildNodes: BuildNode[]
  resourceNodes: ResourceNode[]
  spawnPoints: SpawnPoint[]
  decor: DecorItem[]
  blockedTiles: string
}

// ─── Store snapshot for undo ──────────────────────────────────────────────────

export interface MapSnapshot {
  tiles: Uint8Array
  buildNodes: BuildNode[]
  resourceNodes: ResourceNode[]
  spawnPoints: SpawnPoint[]
}
