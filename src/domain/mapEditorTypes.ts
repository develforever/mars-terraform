// ─── Building & Resource types ───────────────────────────────────────────────

export type BuildingType =
  | 'colony'
  | 'oxygen_generator'
  | 'greenhouse'
  | 'solar_power'
  | 'extractor'

export type ResourceType = 'minerals' | 'ice' | 'organics' | 'energy'

export type TileType = 'empty' | 'build' | 'resource' | 'blocked' | 'spawn'

export type ToolMode = 'build' | 'resource' | 'blocked' | 'spawn' | 'erase' | 'select' | 'terrain'

export type BrushSize = 1 | 3 | 5

export type Richness = 'low' | 'med' | 'high'

// ─── Map entities ─────────────────────────────────────────────────────────────

export interface MapMeta {
  name: string
  description: string
  players: number
}

export interface BuildNode {
  id: string
  pos: [number, number]   // hex coords [q, r]
  footprint: [number, number]
  allowedTypes: BuildingType[]
}

export interface ResourceNode {
  id: string
  type: ResourceType
  pos: [number, number]   // hex coords [q, r]
  amount: number
  richness: Richness
  model: string
}

export interface SpawnPoint {
  player: number
  pos: [number, number]   // hex coords [q, r]
}

export interface DecorItem {
  model: string
  pos: [number, number]   // hex coords [q, r]
  rot: number
  scale: number
}

// ─── Hex export cell ──────────────────────────────────────────────────────────

export interface HexExportCell {
  q: number
  r: number
  terrainType: string
  userType: string | null
  decor: string | null
}

// ─── Export schema v2 ─────────────────────────────────────────────────────────

export interface MapExportJSON {
  meta: {
    name: string
    description: string
    version: '2.0'
    gridType: 'hex-flat-top'
    hexSize: number
    hexRadius: number
    players: number
    seed: number
  }
  hexes: HexExportCell[]
  buildNodes: BuildNode[]
  resourceNodes: ResourceNode[]
  spawnPoints: SpawnPoint[]
  decor: DecorItem[]
}

// ─── Store snapshot for undo ──────────────────────────────────────────────────

export interface MapSnapshot {
  hexCells: [string, Record<string, unknown>][]
  buildNodes: BuildNode[]
  resourceNodes: ResourceNode[]
  spawnPoints: SpawnPoint[]
  decor: DecorItem[]
}
