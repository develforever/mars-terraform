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
import { HexGrid, type HexTerrainType } from '../../presentation/generator/hex/HexGrid'
import { HEX_SIZE } from '../../presentation/generator/hex/HexMath'
import { applyProceduralTerrain } from '../../presentation/generator/terrain/ProceduralTerrain'
import { generateDecor, generateResources, generateSpawns, generateBuildNodes } from '../../presentation/generator/terrain/ProceduralPlacement'

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_UNDO = 20
const DEFAULT_HEX_RADIUS = 20
const DEFAULT_SEED = 42

// ─── State interface ──────────────────────────────────────────────────────────

interface MapEditorState {
  meta: MapMeta
  buildNodes: BuildNode[]
  resourceNodes: ResourceNode[]
  spawnPoints: SpawnPoint[]
  decor: DecorItem[]

  // Hex grid
  hexGrid: HexGrid | null
  hexRadius: number
  hexSeed: number

  // UI state
  activeTool: ToolMode
  brushSize: BrushSize
  activeTerrainType: HexTerrainType
  activeDecorModel: string
  selectedNodeId: string | null
  selectedHex: { q: number; r: number } | null
  hoveredHex: [number, number] | null
  showGrid: boolean
  isPreviewMode: boolean
  fillMode: boolean
  decorSeed: number
  resourceSeed: number
  spawnSeed: number
  buildSeed: number
  undoStack: MapSnapshot[]

  // Node actions
  addBuildNode: (node: BuildNode) => void
  updateBuildNode: (id: string, patch: Partial<BuildNode>) => void
  removeBuildNode: (id: string) => void
  addResourceNode: (node: ResourceNode) => void
  updateResourceNode: (id: string, patch: Partial<ResourceNode>) => void
  removeResourceNode: (id: string) => void
  addSpawnPoint: (spawn: SpawnPoint) => void
  removeSpawnPoint: (player: number) => void
  addDecor: (item: DecorItem) => void
  removeDecorAt: (q: number, r: number) => void

  // UI actions
  setActiveTool: (tool: ToolMode) => void
  setBrushSize: (size: BrushSize) => void
  setActiveTerrainType: (type: HexTerrainType) => void
  setActiveDecorModel: (model: string) => void
  setDecorSeed: (n: number) => void
  setResourceSeed: (n: number) => void
  generateDecorAuto: () => void
  generateResourcesAuto: () => void
  setSpawnSeed: (n: number) => void
  setBuildSeed: (n: number) => void
  generateSpawnsAuto: () => void
  generateBuildAuto: () => void
  setSelectedNodeId: (id: string | null) => void
  selectHex: (q: number, r: number) => void
  clearSelection: () => void
  setHoveredHex: (hex: [number, number] | null) => void
  setShowGrid: (show: boolean) => void
  toggleGrid: () => void
  togglePreview: () => void
  toggleFillMode: () => void
  updateMeta: (patch: Partial<MapMeta>) => void

  // Hex grid actions
  generateHexGrid: (radius?: number, seed?: number) => void
  setHexRadius: (radius: number) => void
  setHexSeed: (seed: number) => void
  setHexUserType: (q: number, r: number, type: TileType | null) => void
  paintHexes: (coords: [number, number][], type: TileType | null) => void
  setHexTerrainType: (q: number, r: number, type: HexTerrainType) => void
  paintHexTerrainType: (coords: [number, number][], type: HexTerrainType) => void

  // Undo
  pushUndo: () => void
  undo: () => void

  // Import / Export
  exportToJSON: () => MapExportJSON
  loadFromJSON: (data: unknown) => void
  resetMap: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const defaultMeta: MapMeta = {
  name: 'mars_map',
  description: '',
  players: 2,
}

const makeSnapshot = (state: MapEditorState): MapSnapshot => ({
  hexCells: state.hexGrid
    ? Array.from(state.hexGrid.snapshot().entries()).map(([k, v]) => [k, { ...v } as Record<string, unknown>])
    : [],
  buildNodes: JSON.parse(JSON.stringify(state.buildNodes)),
  resourceNodes: JSON.parse(JSON.stringify(state.resourceNodes)),
  spawnPoints: JSON.parse(JSON.stringify(state.spawnPoints)),
  decor: JSON.parse(JSON.stringify(state.decor)),
})

// Force Zustand re-render by replacing HexGrid reference (same class, same cells)
const refreshGrid = (grid: HexGrid): HexGrid =>
  Object.assign(Object.create(Object.getPrototypeOf(grid)), grid)

// ─── Store ────────────────────────────────────────────────────────────────────

export const useMapEditorStore = create<MapEditorState>((set, get) => ({
  meta: { ...defaultMeta },
  buildNodes: [],
  resourceNodes: [],
  spawnPoints: [],
  decor: [],

  hexGrid: null,
  hexRadius: DEFAULT_HEX_RADIUS,
  hexSeed: DEFAULT_SEED,

  activeTool: 'select',
  brushSize: 1,
  activeTerrainType: 'plains',
  activeDecorModel: 'rock_01',
  selectedNodeId: null,
  selectedHex: null,
  hoveredHex: null,
  showGrid: true,
  isPreviewMode: false,
  fillMode: false,
  decorSeed: 1,
  resourceSeed: 1,
  spawnSeed: 1,
  buildSeed: 1,
  undoStack: [],

  // ── Node actions ───────────────────────────────────────────────────────────

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

  addDecor: (item) => {
    get().pushUndo()
    set(state => ({ decor: [...state.decor, item] }))
  },

  removeDecorAt: (q, r) => {
    const exists = get().decor.some(d => d.pos[0] === q && d.pos[1] === r)
    if (!exists) return
    get().pushUndo()
    set(state => ({ decor: state.decor.filter(d => !(d.pos[0] === q && d.pos[1] === r)) }))
  },

  // ── UI actions ─────────────────────────────────────────────────────────────

  setActiveTool: (tool) => set({ activeTool: tool }),
  setBrushSize: (size) => set({ brushSize: size }),
  setActiveTerrainType: (type) => set({ activeTerrainType: type }),
  setActiveDecorModel: (model) => set({ activeDecorModel: model }),
  setDecorSeed: (n) => set({ decorSeed: n }),
  setResourceSeed: (n) => set({ resourceSeed: n }),
  generateDecorAuto: () => {
    const grid = get().hexGrid
    if (!grid) return
    get().pushUndo()
    set({ decor: generateDecor(grid, get().decorSeed) })
  },
  generateResourcesAuto: () => {
    const grid = get().hexGrid
    if (!grid) return
    get().pushUndo()
    set({ resourceNodes: generateResources(grid, get().resourceSeed, get().meta.players) })
  },
  setSpawnSeed: (n) => set({ spawnSeed: n }),
  setBuildSeed: (n) => set({ buildSeed: n }),
  generateSpawnsAuto: () => {
    const grid = get().hexGrid
    if (!grid) return
    get().pushUndo()
    set({ spawnPoints: generateSpawns(grid, get().spawnSeed, get().meta.players) })
  },
  generateBuildAuto: () => {
    const grid = get().hexGrid
    if (!grid) return
    get().pushUndo()
    set({ buildNodes: generateBuildNodes(grid, get().buildSeed, get().meta.players, get().spawnPoints) })
  },
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  selectHex: (q, r) => set({ selectedHex: { q, r }, selectedNodeId: null }),
  clearSelection: () => set({ selectedHex: null, selectedNodeId: null }),
  setHoveredHex: (hex) => set({ hoveredHex: hex }),
  setShowGrid: (show) => set({ showGrid: show }),
  toggleGrid: () => set(state => ({ showGrid: !state.showGrid })),
  toggleFillMode: () => set(state => ({ fillMode: !state.fillMode })),
  togglePreview: () => set(state => ({ isPreviewMode: !state.isPreviewMode })),
  updateMeta: (patch) => set(state => ({ meta: { ...state.meta, ...patch } })),

  // ── Hex grid actions ───────────────────────────────────────────────────────

  generateHexGrid: (radius, seed) => {
    const r = radius ?? get().hexRadius
    const s = seed ?? get().hexSeed
    const grid = new HexGrid(r, s)
    grid.generate()
    applyProceduralTerrain(grid, s)   // seed -> proceduralny teren (deterministyczny)
    set({ hexGrid: grid, hexRadius: r, hexSeed: s, selectedHex: null, selectedNodeId: null })
  },

  setHexRadius: (radius) => set({ hexRadius: radius }),
  setHexSeed: (seed) => set({ hexSeed: seed }),

  setHexUserType: (q, r, type) => {
    const grid = get().hexGrid
    if (!grid) return
    get().pushUndo()
    grid.setUserType(q, r, type)
    set({ hexGrid: refreshGrid(grid) })
  },

  paintHexes: (coords, type) => {
    const grid = get().hexGrid
    if (!grid) return
    get().pushUndo()
    for (const [q, r] of coords) grid.setUserType(q, r, type)
    set({ hexGrid: refreshGrid(grid) })
  },

  setHexTerrainType: (q, r, type) => {
    const grid = get().hexGrid
    if (!grid) return
    get().pushUndo()
    grid.setTerrainType(q, r, type)
    set({ hexGrid: refreshGrid(grid) })
  },

  paintHexTerrainType: (coords, type) => {
    const grid = get().hexGrid
    if (!grid) return
    get().pushUndo()
    for (const [q, r] of coords) grid.setTerrainType(q, r, type)
    set({ hexGrid: refreshGrid(grid) })
  },

  // ── Undo ───────────────────────────────────────────────────────────────────

  pushUndo: () => {
    set(state => {
      const stack = [...state.undoStack, makeSnapshot(state)]
      if (stack.length > MAX_UNDO) stack.shift()
      return { undoStack: stack }
    })
  },

  undo: () => {
    const state = get()
    if (state.undoStack.length === 0) return
    const stack = [...state.undoStack]
    const prev = stack.pop()!

    let hexGrid = state.hexGrid
    if (hexGrid && prev.hexCells.length > 0) {
      // Rebuild Map<string, HexCell> from serialized snapshot
      type HexCellLike = import('../../presentation/generator/hex/HexGrid').HexCell
      const snap = new Map(
        prev.hexCells.map(([k, v]) => [k, v as unknown as HexCellLike])
      )
      hexGrid.restoreSnapshot(snap)
      hexGrid = refreshGrid(hexGrid)
    }

    set({
      hexGrid,
      buildNodes: prev.buildNodes,
      resourceNodes: prev.resourceNodes,
      spawnPoints: prev.spawnPoints,
      decor: prev.decor,
      undoStack: stack,
    })
  },

  // ── Import / Export ────────────────────────────────────────────────────────

  exportToJSON: (): MapExportJSON => {
    const state = get()
    const hexes = state.hexGrid
      ? state.hexGrid.getAllCells().map(c => ({
          q: c.q,
          r: c.r,
          terrainType: c.terrainType,
          userType: c.userType,
          decor: c.decor,
        }))
      : []

    return {
      meta: {
        name: state.meta.name,
        description: state.meta.description,
        version: '2.0',
        gridType: 'hex-flat-top',
        hexSize: HEX_SIZE,
        hexRadius: state.hexRadius,
        players: state.meta.players,
        seed: state.hexSeed,
      },
      hexes,
      buildNodes: JSON.parse(JSON.stringify(state.buildNodes)),
      resourceNodes: JSON.parse(JSON.stringify(state.resourceNodes)),
      spawnPoints: JSON.parse(JSON.stringify(state.spawnPoints)),
      decor: JSON.parse(JSON.stringify(state.decor)),
    }
  },

  loadFromJSON: (data: unknown) => {
    const d = data as Record<string, unknown>
    const meta = (d.meta ?? {}) as Record<string, unknown>
    const isV2 = meta.version === '2.0' || Array.isArray(d.hexes)

    if (isV2) {
      const radius = (meta.hexRadius as number) ?? DEFAULT_HEX_RADIUS
      const seed = (meta.seed as number) ?? DEFAULT_SEED
      const grid = new HexGrid(radius, seed)
      grid.generate()
      grid.fromJSON({ hexes: (d.hexes as Partial<import('../../presentation/generator/hex/HexGrid').HexCell>[]) ?? [] })

      set({
        meta: {
          name: (meta.name as string) ?? 'mars_map',
          description: (meta.description as string) ?? '',
          players: (meta.players as number) ?? 2,
        },
        hexGrid: grid,
        hexRadius: radius,
        hexSeed: seed,
        buildNodes: (d.buildNodes as BuildNode[]) ?? [],
        resourceNodes: (d.resourceNodes as ResourceNode[]) ?? [],
        spawnPoints: (d.spawnPoints as SpawnPoint[]) ?? [],
        decor: (d.decor as DecorItem[]) ?? [],
        undoStack: [],
        selectedHex: null,
        selectedNodeId: null,
      })
    }
  },

  resetMap: () => {
    const state = get()
    const grid = new HexGrid(state.hexRadius, state.hexSeed)
    grid.generate()
    set({
      meta: { ...defaultMeta },
      hexGrid: grid,
      buildNodes: [],
      resourceNodes: [],
      spawnPoints: [],
      decor: [],
      undoStack: [],
      selectedHex: null,
      selectedNodeId: null,
    })
  },
}))
