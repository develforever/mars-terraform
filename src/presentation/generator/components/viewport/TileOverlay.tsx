import { useRef, useMemo, useCallback, useEffect } from 'react'
import * as THREE from 'three'
import { useMapEditorStore } from '../../../../application/store/useMapEditorStore'
import type { TileType, BuildNode, ResourceNode, SpawnPoint } from '../../../../domain/mapEditorTypes'

// ─── Tile color map ───────────────────────────────────────────────────────────

const TILE_COLORS: Record<number, THREE.Color> = {
  1: new THREE.Color('#00ff88'), // build
  2: new THREE.Color('#ffcc00'), // resource
  3: new THREE.Color('#ff3300'), // blocked
  4: new THREE.Color('#0088ff'), // spawn
}

const TILE_TYPE_INDEX: Record<string, number> = {
  empty: 0, build: 1, resource: 2, blocked: 3, spawn: 4,
}

const HOVER_COLOR = new THREE.Color('#ffffff')
const TRANSPARENT = new THREE.Color('#000000')

const MAP_SIZE = 100

// ─── Helpers ──────────────────────────────────────────────────────────────────

const worldToTile = (wx: number, wz: number): [number, number] => {
  const x = Math.floor(wx + MAP_SIZE / 2)
  const z = Math.floor(wz + MAP_SIZE / 2)
  return [
    Math.max(0, Math.min(MAP_SIZE - 1, x)),
    Math.max(0, Math.min(MAP_SIZE - 1, z)),
  ]
}

const tileToWorld = (tx: number, tz: number): [number, number] => [
  tx - MAP_SIZE / 2 + 0.5,
  tz - MAP_SIZE / 2 + 0.5,
]

const getBrushCoords = (cx: number, cz: number, size: number): [number, number][] => {
  const half = Math.floor(size / 2)
  const coords: [number, number][] = []
  for (let dx = -half; dx <= half; dx++) {
    for (let dz = -half; dz <= half; dz++) {
      const x = cx + dx
      const z = cz + dz
      if (x >= 0 && x < MAP_SIZE && z >= 0 && z < MAP_SIZE) {
        coords.push([x, z])
      }
    }
  }
  return coords
}

// ─── Component ────────────────────────────────────────────────────────────────

const TileOverlay = () => {
  const tiles = useMapEditorStore(s => s.tiles)
  const activeTool = useMapEditorStore(s => s.activeTool)
  const brushSize = useMapEditorStore(s => s.brushSize)
  const paintTiles = useMapEditorStore(s => s.paintTiles)
  const setSelectedNodeId = useMapEditorStore(s => s.setSelectedNodeId)
  const addBuildNode = useMapEditorStore(s => s.addBuildNode)
  const addResourceNode = useMapEditorStore(s => s.addResourceNode)
  const addSpawnPoint = useMapEditorStore(s => s.addSpawnPoint)
  const buildNodes = useMapEditorStore(s => s.buildNodes)
  const resourceNodes = useMapEditorStore(s => s.resourceNodes)
  const spawnPoints = useMapEditorStore(s => s.spawnPoints)

  const meshRef = useRef<THREE.InstancedMesh>(null)
  const hoverRef = useRef<{ x: number; z: number } | null>(null)
  const isPainting = useRef(false)

  const count = MAP_SIZE * MAP_SIZE

  // ── Build instanced geometry ────────────────────────────────────────────────
  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1), [])
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        side: THREE.DoubleSide,
        vertexColors: false,
      }),
    []
  )

  // ── Sync instance matrices (positions never change) ─────────────────────────
  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const matrix = new THREE.Matrix4()
    const rot = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0))
    for (let z = 0; z < MAP_SIZE; z++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        const [wx, wz] = tileToWorld(x, z)
        matrix.compose(
          new THREE.Vector3(wx, 0.08, wz),
          rot,
          new THREE.Vector3(0.98, 0.98, 1)
        )
        mesh.setMatrixAt(z * MAP_SIZE + x, matrix)
      }
    }
    mesh.instanceMatrix.needsUpdate = true
  // runs once after mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Sync instance colors from tiles store ───────────────────────────────────
  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    for (let i = 0; i < count; i++) {
      const tileVal = tiles[i]
      const color = tileVal > 0 ? TILE_COLORS[tileVal] ?? TRANSPARENT : TRANSPARENT
      mesh.setColorAt(i, color)
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [tiles, count])

  // ── Hover highlight ─────────────────────────────────────────────────────────
  const applyHover = useCallback((tx: number, tz: number) => {
    const mesh = meshRef.current
    if (!mesh) return
    // Clear previous hover
    if (hoverRef.current) {
      const { x, z } = hoverRef.current
      const brushCoords = getBrushCoords(x, z, brushSize)
      for (const [bx, bz] of brushCoords) {
        const i = bz * MAP_SIZE + bx
        const tileVal = tiles[i]
        const color = tileVal > 0 ? TILE_COLORS[tileVal] ?? TRANSPARENT : TRANSPARENT
        mesh.setColorAt(i, color)
      }
    }
    // Apply new hover
    const brushCoords = getBrushCoords(tx, tz, brushSize)
    for (const [bx, bz] of brushCoords) {
      mesh.setColorAt(bz * MAP_SIZE + bx, HOVER_COLOR)
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    hoverRef.current = { x: tx, z: tz }
  }, [tiles, brushSize])

  const clearHover = useCallback(() => {
    const mesh = meshRef.current
    if (!mesh || !hoverRef.current) return
    const { x, z } = hoverRef.current
    const brushCoords = getBrushCoords(x, z, brushSize)
    for (const [bx, bz] of brushCoords) {
      const i = bz * MAP_SIZE + bx
      const tileVal = tiles[i]
      const color = tileVal > 0 ? TILE_COLORS[tileVal] ?? TRANSPARENT : TRANSPARENT
      mesh.setColorAt(i, color)
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    hoverRef.current = null
  }, [tiles, brushSize])

  // ── Tool → TileType ─────────────────────────────────────────────────────────
  const toolToTileType = (tool: string): TileType | null => {
    const map: Record<string, TileType> = {
      build: 'build', resource: 'resource', blocked: 'blocked', spawn: 'spawn', erase: 'empty',
    }
    return map[tool] ?? null
  }

  // ── Create node on click ──────────────────────────────────────────────────
  const createNodeAt = useCallback((tx: number, tz: number) => {
    if (activeTool === 'build') {
      // Don't duplicate on same tile
      if (buildNodes.some(n => n.pos[0] === tx && n.pos[1] === tz)) return
      const node: BuildNode = {
        id: `b${Date.now()}`,
        pos: [tx, tz],
        footprint: [3, 3],
        allowedTypes: ['colony'],
      }
      addBuildNode(node)
      paintTiles(getBrushCoords(tx, tz, 3), 'build')
    } else if (activeTool === 'resource') {
      if (resourceNodes.some(n => n.pos[0] === tx && n.pos[1] === tz)) return
      const node: ResourceNode = {
        id: `r${Date.now()}`,
        type: 'minerals',
        pos: [tx, tz],
        amount: 1000,
        richness: 'med',
        model: 'mineral_pile_01',
      }
      addResourceNode(node)
      paintTiles([[tx, tz]], 'resource')
    } else if (activeTool === 'spawn') {
      const nextPlayer = Math.min(4, (spawnPoints.length) + 1) as 1 | 2 | 3 | 4
      if (spawnPoints.some(s => s.player === nextPlayer)) return
      const spawn: SpawnPoint = { player: nextPlayer, pos: [tx, tz] }
      addSpawnPoint(spawn)
      paintTiles([[tx, tz]], 'spawn')
    }
  }, [activeTool, buildNodes, resourceNodes, spawnPoints, addBuildNode, addResourceNode, addSpawnPoint, paintTiles])

  // ── Paint at position ───────────────────────────────────────────────────────
  const paintAt = useCallback((wx: number, wz: number) => {
    const tileType = toolToTileType(activeTool)
    if (!tileType && activeTool !== 'erase') return
    const [tx, tz] = worldToTile(wx, wz)
    const coords = getBrushCoords(tx, tz, brushSize)
    paintTiles(coords, tileType ?? 'empty')
  }, [activeTool, brushSize, paintTiles])

  // ── Invisible hit plane for raycasting ──────────────────────────────────────
  return (
    <>
      {/* Instanced tile quads */}
      <instancedMesh
        ref={meshRef}
        args={[geometry, material, count]}
        frustumCulled={false}
      />

      {/* Invisible hit plane — catches pointer events */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.01, 0]}
        onPointerMove={e => {
          e.stopPropagation()
          const { x, z } = e.point
          const [tx, tz] = worldToTile(x, z)
          applyHover(tx, tz)
          if (isPainting.current) paintAt(x, z)
        }}
        onPointerDown={e => {
          e.stopPropagation()
          if (e.button !== 0) return
          isPainting.current = true
          const { x, z } = e.point
          const [tx, tz] = worldToTile(x, z)
          if (activeTool === 'select') {
            setSelectedNodeId(null)
            return
          }
          if (activeTool === 'build' || activeTool === 'resource' || activeTool === 'spawn') {
            createNodeAt(tx, tz)
            return
          }
          paintAt(x, z)
        }}
        onPointerUp={() => { isPainting.current = false }}
        onPointerLeave={() => {
          isPainting.current = false
          clearHover()
        }}
      >
        <planeGeometry args={[MAP_SIZE, MAP_SIZE]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </>
  )
}

export default TileOverlay
