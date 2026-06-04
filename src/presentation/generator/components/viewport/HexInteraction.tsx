/**
 * HexInteraction.tsx
 * Invisible hit plane + brush highlight overlay.
 *
 * Ray correction: e.ray.intersectPlane at terrain Y (not e.point which is at
 * the plane's Y) eliminates the camera-angle offset regardless of terrain height.
 */

import { useRef, useMemo, useCallback, useEffect } from 'react'
import * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { useMapEditorStore } from '../../../../application/store/useMapEditorStore'
import { buildBrushHighlightGeometry } from '../../hex/HexGeometry'
import { worldToHex, hexBrush } from '../../hex/HexMath'
import { TERRAIN_HEIGHT } from '../../hex/HexGrid'
import type { TileType, BuildNode, ResourceNode, SpawnPoint } from '../../../../domain/mapEditorTypes'

// ─── Tool → highlight color ───────────────────────────────────────────────────

const TOOL_COLORS: Record<string, number> = {
  select:   0xffffff,
  build:    0x00ff88,
  resource: 0xffcc00,
  blocked:  0xff3300,
  spawn:    0x0088ff,
  erase:    0xff6622,
  terrain:  0xffa040,
}

// Reusable objects — allocated once outside the component
const _intersectTarget = new THREE.Vector3()
const _terrainPlane    = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TERRAIN_HEIGHT['plains'])

// ─── Component ────────────────────────────────────────────────────────────────

const HexInteraction = () => {
  const hexGrid          = useMapEditorStore(s => s.hexGrid)
  const activeTool       = useMapEditorStore(s => s.activeTool)
  const brushSize        = useMapEditorStore(s => s.brushSize)
  const activeTerrainType = useMapEditorStore(s => s.activeTerrainType)
  const hoveredHex       = useMapEditorStore(s => s.hoveredHex)
  const setHoveredHex    = useMapEditorStore(s => s.setHoveredHex)
  const selectHex        = useMapEditorStore(s => s.selectHex)
  const paintHexes       = useMapEditorStore(s => s.paintHexes)
  const paintHexTerrainType = useMapEditorStore(s => s.paintHexTerrainType)
  const addBuildNode     = useMapEditorStore(s => s.addBuildNode)
  const addResourceNode  = useMapEditorStore(s => s.addResourceNode)
  const addSpawnPoint    = useMapEditorStore(s => s.addSpawnPoint)
  const buildNodes       = useMapEditorStore(s => s.buildNodes)
  const resourceNodes    = useMapEditorStore(s => s.resourceNodes)
  const spawnPoints      = useMapEditorStore(s => s.spawnPoints)

  const isPainting = useRef(false)

  // ── Brush hex coords ──────────────────────────────────────────────────────

  const brushCoords = useMemo((): [number, number][] => {
    if (!hoveredHex || !hexGrid) return []
    const [q, r] = hoveredHex
    return hexBrush(q, r, brushSize).filter(([bq, br]) => hexGrid.hasCell(bq, br))
  }, [hoveredHex, brushSize, hexGrid])

  // ── Highlight geometry ────────────────────────────────────────────────────

  const highlightGeo = useMemo(() => {
    if (brushCoords.length === 0 || !hexGrid) return null
    const coordsWithY = brushCoords.map(([q, r]): [number, number, number] => {
      const cell = hexGrid.getCell(q, r)
      return [q, r, (cell?.worldY ?? 0) + 0.08]
    })
    return buildBrushHighlightGeometry(coordsWithY)
  }, [brushCoords, hexGrid])

  useEffect(() => () => { highlightGeo?.dispose() }, [highlightGeo])

  // ── Get hex from pointer event ─────────────────────────────────────────────
  // Use e.ray to intersect with the terrain plane at plains Y.
  // This corrects camera-angle offset regardless of hit-plane Y.

  const getHexFromEvent = useCallback((e: ThreeEvent<PointerEvent>): [number, number] | null => {
    if (!hexGrid) return null
    e.ray.intersectPlane(_terrainPlane, _intersectTarget)
    const [q, r] = worldToHex(_intersectTarget.x, _intersectTarget.z)
    return hexGrid.hasCell(q, r) ? [q, r] : null
  }, [hexGrid])

  // ── Painting ──────────────────────────────────────────────────────────────

  const paintAt = useCallback((q: number, r: number) => {
    if (!hexGrid) return
    const coords = hexBrush(q, r, brushSize).filter(([bq, br]) => hexGrid.hasCell(bq, br))

    if (activeTool === 'terrain') {
      paintHexTerrainType(coords, activeTerrainType)
      return
    }
    if (activeTool === 'erase') {
      paintHexes(coords, null)
      paintHexTerrainType(coords, 'plains')
      return
    }
    const tileMap: Record<string, TileType> = {
      build: 'build', resource: 'resource', blocked: 'blocked', spawn: 'spawn',
    }
    const tileType = tileMap[activeTool]
    if (tileType) paintHexes(coords, tileType)
  }, [activeTool, brushSize, hexGrid, paintHexes, paintHexTerrainType, activeTerrainType])

  const createNodeAt = useCallback((q: number, r: number) => {
    if (activeTool === 'build') {
      if (buildNodes.some(n => n.pos[0] === q && n.pos[1] === r)) return
      const node: BuildNode = { id: `b${Date.now()}`, pos: [q, r], footprint: [1, 1], allowedTypes: ['colony'] }
      addBuildNode(node)
      paintHexes([[q, r]], 'build')
    } else if (activeTool === 'resource') {
      if (resourceNodes.some(n => n.pos[0] === q && n.pos[1] === r)) return
      const node: ResourceNode = { id: `r${Date.now()}`, type: 'minerals', pos: [q, r], amount: 1000, richness: 'med', model: 'mineral_pile_01' }
      addResourceNode(node)
      paintHexes([[q, r]], 'resource')
    } else if (activeTool === 'spawn') {
      const nextPlayer = Math.min(4, spawnPoints.length + 1) as 1 | 2 | 3 | 4
      if (spawnPoints.some(s => s.player === nextPlayer)) return
      addSpawnPoint({ player: nextPlayer, pos: [q, r] } as SpawnPoint)
      paintHexes([[q, r]], 'spawn')
    }
  }, [activeTool, buildNodes, resourceNodes, spawnPoints, addBuildNode, addResourceNode, addSpawnPoint, paintHexes])

  // ── Pointer handlers ──────────────────────────────────────────────────────

  const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    const hex = getHexFromEvent(e)
    if (hex) {
      setHoveredHex(hex)
      if (isPainting.current) paintAt(hex[0], hex[1])
    } else {
      setHoveredHex(null)
    }
  }, [getHexFromEvent, setHoveredHex, paintAt])

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (e.nativeEvent.button !== 0) return
    const hex = getHexFromEvent(e)
    if (!hex) return

    isPainting.current = true
    const [q, r] = hex

    if (activeTool === 'select') { selectHex(q, r); return }
    if (activeTool === 'build' || activeTool === 'resource' || activeTool === 'spawn') {
      createNodeAt(q, r); return
    }
    paintAt(q, r)
  }, [getHexFromEvent, activeTool, selectHex, createNodeAt, paintAt])

  return (
    <>
      {/* Brush highlight */}
      {highlightGeo && (
        <mesh geometry={highlightGeo} frustumCulled={false}>
          <meshBasicMaterial
            color={TOOL_COLORS[activeTool] ?? 0xffffff}
            transparent
            opacity={0.32}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Invisible hit plane — large, at a convenient Y for the camera */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, TERRAIN_HEIGHT['plains'], 0]}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={() => { isPainting.current = false }}
        onPointerLeave={() => { isPainting.current = false; setHoveredHex(null) }}
      >
        <planeGeometry args={[500, 500]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </>
  )
}

export default HexInteraction
