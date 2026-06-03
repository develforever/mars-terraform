import { create } from 'zustand'
import type {
  ToolMode,
  BrushSize,
  TileType,
  BuildNode,
  ResourceNode,
  SpawnPoint,
  DecorItem,
  MapMeta,
  MapExportJSON,
  MapSnapshot,
} from '../../domain/mapEditorTypes'

// ─── Constants ────────────────────────────────────────────────────────────────

const MAP_SIZE = 100
const MAX_UNDO = 20

// ─── Scatter options ──────────────────────────────────────────────────────────

export interface ScatterOptions {
  rocks: number        // number of rock decor items
  minerals: number     // number of mineral resource nodes
  ice: number          // number of ice resource nodes
  organics: number     // number of organics resource nodes
  energy: number       // number of energy resource nodes
  clearExisting: boolean
  seed: number
}

const TILE_TYPE_INDEX: Record<TileType, number> = {
  empty: 0,
  build: 1,
  resource: 2,
  blocked: 3,
  spawn: 4,
}

const INDEX_TO_TILE: TileType[] = ['empty', 'build', 'resource', 'blocked', 'spawn']

const defaultMeta: MapMeta = {
  name: 'mars_map',
  description: '',
  size: [MAP_SIZE, MAP_SIZE],
  tileSize: 1,
  players: 2,
  terrainFile: 'mars_terrain.glb',
  seed: null,
}

// ─── State interface ──────────────────────────────────────────────────────────

interface MapEditorState {
  meta: MapMeta
  tiles: Uint8Array
  buildNodes: BuildNode[]
  resourceNodes: ResourceNode[]
  spawnPoints: SpawnPoint[]
  decor: DecorItem[]

  // UI state
  activeTool: ToolMode
  brushSize: BrushSize
  selectedNodeId: string | null
  showGrid: boolean
  undoStack: MapSnapshot[]

  // Tile accessors
  getTileType: (x: number, z: number) => TileType
  setTile: (x: number, z: number, type: TileType) => void
  paintTiles: (coords: [number, number][], type: TileType) => void

  // Node actions
  addBuildNode: (node: BuildNode) => void
  updateBuildNode: (id: string, patch: Partial<BuildNode>) => void
  removeBuildNode: (id: string) => void
  addResourceNode: (node: ResourceNode) => void
  updateResourceNode: (id: string, patch: Partial<ResourceNode>) => void
  removeResourceNode: (id: string) => void
  addSpawnPoint: (spawn: SpawnPoint) => void
  removeSpawnPoint: (player: number) => void

  // UI actions
  setActiveTool: (tool: ToolMode) => void
  setBrushSize: (size: BrushSize) => void
  setSelectedNodeId: (id: string | null) => void
  setShowGrid: (show: boolean) => void
  toggleGrid: () => void
  updateMeta: (patch: Partial<MapMeta>) => void

  // Undo
  pushUndo: () => void
  undo: () => void

  // Import / Export
  exportToJSON: () => MapExportJSON
  loadFromJSON: (data: MapExportJSON) => void
  resetMap: () => void

  // Auto-scatter
  autoScatter: (opts: ScatterOptions) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const tileIndex = (x: number, z: number) => z * MAP_SIZE + x

const snapshot = (state: MapEditorState): MapSnapshot => ({
  tiles: new Uint8Array(state.tiles),
  buildNodes: JSON.parse(JSON.stringify(state.buildNodes)),
  resourceNodes: JSON.parse(JSON.stringify(state.resourceNodes)),
  spawnPoints: JSON.parse(JSON.stringify(state.spawnPoints)),
})

// ─── Store ────────────────────────────────────────────────────────────────────

export const useMapEditorStore = create<MapEditorState>((set, get) => ({
  meta: { ...defaultMeta },
  tiles: new Uint8Array(MAP_SIZE * MAP_SIZE),
  buildNodes: [],
  resourceNodes: [],
  spawnPoints: [],
  decor: [],

  activeTool: 'select',
  brushSize: 1,
  selectedNodeId: null,
  showGrid: true,
  undoStack: [],

  getTileType: (x, z) => {
    const val = get().tiles[tileIndex(x, z)]
    return INDEX_TO_TILE[val] ?? 'empty'
  },

  setTile: (x, z, type) => {
    set(state => {
      const tiles = new Uint8Array(state.tiles)
      tiles[tileIndex(x, z)] = TILE_TYPE_INDEX[type]
      return { tiles }
    })
  },

  paintTiles: (coords, type) => {
    get().pushUndo()
    set(state => {
      const tiles = new Uint8Array(state.tiles)
      for (const [x, z] of coords) {
        if (x >= 0 && x < MAP_SIZE && z >= 0 && z < MAP_SIZE) {
          tiles[tileIndex(x, z)] = TILE_TYPE_INDEX[type]
        }
      }
      return { tiles }
    })
  },

  addBuildNode: (node) => {
    get().pushUndo()
    set(state => ({ buildNodes: [...state.buildNodes, node] }))
  },

  updateBuildNode: (id, patch) =>
    set(state => ({
      buildNodes: state.buildNodes.map(n => (n.id === id ? { ...n, ...patch } : n)),
    })),

  removeBuildNode: (id) => {
    get().pushUndo()
    set(state => ({ buildNodes: state.buildNodes.filter(n => n.id !== id) }))
  },

  addResourceNode: (node) => {
    get().pushUndo()
    set(state => ({ resourceNodes: [...state.resourceNodes, node] }))
  },

  updateResourceNode: (id, patch) =>
    set(state => ({
      resourceNodes: state.resourceNodes.map(n => (n.id === id ? { ...n, ...patch } : n)),
    })),

  removeResourceNode: (id) => {
    get().pushUndo()
    set(state => ({ resourceNodes: state.resourceNodes.filter(n => n.id !== id) }))
  },

  addSpawnPoint: (spawn) => {
    get().pushUndo()
    set(state => ({
      spawnPoints: [
        ...state.spawnPoints.filter(s => s.player !== spawn.player),
        spawn,
      ],
    }))
  },

  removeSpawnPoint: (player) => {
    get().pushUndo()
    set(state => ({ spawnPoints: state.spawnPoints.filter(s => s.player !== player) }))
  },

  setActiveTool: (tool) => set({ activeTool: tool }),
  setBrushSize: (size) => set({ brushSize: size }),
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setShowGrid: (show) => set({ showGrid: show }),
  toggleGrid: () => set(state => ({ showGrid: !state.showGrid })),
  updateMeta: (patch) => set(state => ({ meta: { ...state.meta, ...patch } })),

  pushUndo: () => {
    set(state => {
      const stack = [...state.undoStack, snapshot(state)]
      if (stack.length > MAX_UNDO) stack.shift()
      return { undoStack: stack }
    })
  },

  undo: () => {
    set(state => {
      if (state.undoStack.length === 0) return {}
      const stack = [...state.undoStack]
      const prev = stack.pop()!
      return {
        tiles: prev.tiles,
        buildNodes: prev.buildNodes,
        resourceNodes: prev.resourceNodes,
        spawnPoints: prev.spawnPoints,
        undoStack: stack,
      }
    })
  },

  exportToJSON: (): MapExportJSON => {
    const state = get()
    // Simple base64 encode of blocked tiles bitmask (pako added later)
    const blocked = btoa(String.fromCharCode(...state.tiles))
    return {
      meta: { ...state.meta },
      buildNodes: JSON.parse(JSON.stringify(state.buildNodes)),
      resourceNodes: JSON.parse(JSON.stringify(state.resourceNodes)),
      spawnPoints: JSON.parse(JSON.stringify(state.spawnPoints)),
      decor: JSON.parse(JSON.stringify(state.decor)),
      blockedTiles: blocked,
    }
  },

  loadFromJSON: (data) => {
    const tiles = new Uint8Array(MAP_SIZE * MAP_SIZE)
    try {
      const raw = atob(data.blockedTiles)
      for (let i = 0; i < raw.length && i < tiles.length; i++) {
        tiles[i] = raw.charCodeAt(i)
      }
    } catch {
      // ignore corrupt blockedTiles
    }
    set({
      meta: { ...defaultMeta, ...data.meta },
      tiles,
      buildNodes: data.buildNodes ?? [],
      resourceNodes: data.resourceNodes ?? [],
      spawnPoints: data.spawnPoints ?? [],
      decor: data.decor ?? [],
      undoStack: [],
    })
  },

  resetMap: () =>
    set({
      meta: { ...defaultMeta },
      tiles: new Uint8Array(MAP_SIZE * MAP_SIZE),
      buildNodes: [],
      resourceNodes: [],
      spawnPoints: [],
      decor: [],
      undoStack: [],
      selectedNodeId: null,
    }),

  autoScatter: (opts) => {
    get().pushUndo()

    // Seeded pseudo-random (simple LCG)
    let seed = opts.seed >>> 0
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 0xFFFFFFFF
    }
    const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min
    const randTile = (): [number, number] => [randInt(2, MAP_SIZE - 3), randInt(2, MAP_SIZE - 3)]

    set(state => {
      const tiles = new Uint8Array(state.tiles)
      const newDecor: DecorItem[] = opts.clearExisting ? [] : [...state.decor]
      const newResources: ResourceNode[] = opts.clearExisting ? [] : [...state.resourceNodes]

      // Occupied set — don't double-place
      const occupied = new Set<number>()
      for (let i = 0; i < tiles.length; i++) {
        if (tiles[i] !== 0) occupied.add(i)
      }
      const occupy = (x: number, z: number) => occupied.add(z * MAP_SIZE + x)
      const isFree = (x: number, z: number) => !occupied.has(z * MAP_SIZE + x)

      // Scatter rocks (decor + blocked tiles)
      const ROCK_MODELS = ['rock_a', 'rock_b', 'rock_c', 'rock_cluster']
      let placed = 0
      let attempts = 0
      while (placed < opts.rocks && attempts < opts.rocks * 10) {
        attempts++
        const [x, z] = randTile()
        if (!isFree(x, z)) continue
        newDecor.push({
          model: ROCK_MODELS[randInt(0, ROCK_MODELS.length - 1)],
          pos: [x, z],
          rot: rand() * Math.PI * 2,
          scale: 0.6 + rand() * 0.8,
        })
        tiles[z * MAP_SIZE + x] = 3 // blocked
        occupy(x, z)
        placed++
      }

      // Scatter resource nodes
      const resourceDefs: { type: ResourceNode['type']; count: number }[] = [
        { type: 'minerals', count: opts.minerals },
        { type: 'ice',      count: opts.ice },
        { type: 'organics', count: opts.organics },
        { type: 'energy',   count: opts.energy },
      ]

      for (const { type, count } of resourceDefs) {
        let rPlaced = 0
        let rAttempts = 0
        while (rPlaced < count && rAttempts < count * 10) {
          rAttempts++
          const [x, z] = randTile()
          if (!isFree(x, z)) continue
          newResources.push({
            id: `r${Date.now()}${rPlaced}${type[0]}`,
            type,
            pos: [x, z],
            amount: randInt(500, 3000),
            richness: (['low', 'med', 'high'] as const)[randInt(0, 2)],
            model: `${type}_pile_0${randInt(1, 2)}`,
          })
          tiles[z * MAP_SIZE + x] = 2 // resource
          occupy(x, z)
          rPlaced++
        }
      }

      return { tiles, decor: newDecor, resourceNodes: newResources }
    })
  },
}))
