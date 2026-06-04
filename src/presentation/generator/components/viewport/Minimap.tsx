import { useEffect, useRef } from 'react'
import { useMapEditorStore } from '../../../../application/store/useMapEditorStore'
import { hexToWorld, hexCorners, HEX_SIZE } from '../../hex/HexMath'
import { TERRAIN_COLORS } from '../../hex/HexGrid'

const CANVAS_SIZE = 180
const PADDING = 8  // px padding inside canvas so edge hexes aren't clipped
const PLAYER_COLORS = ['#4488ff', '#ff4444', '#44ff88', '#ffaa00']

const USER_COLORS: Record<string, string> = {
  build:    '#00ff88',
  resource: '#ffcc00',
  blocked:  '#ff3300',
  spawn:    '#0088ff',
}

const Minimap = () => {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const hexGrid      = useMapEditorStore(s => s.hexGrid)
  const buildNodes   = useMapEditorStore(s => s.buildNodes)
  const resourceNodes = useMapEditorStore(s => s.resourceNodes)
  const spawnPoints  = useMapEditorStore(s => s.spawnPoints)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !hexGrid) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // World extent: flat-top hex grid radius in world units
    // Flat-top: X extent = radius * 1.5 * HEX_SIZE, Z extent = radius * sqrt(3) * HEX_SIZE
    const MAP_RADIUS = hexGrid.radius
    const worldExtentX = MAP_RADIUS * HEX_SIZE * 1.5 + HEX_SIZE
    const worldExtentZ = MAP_RADIUS * HEX_SIZE * Math.sqrt(3) + HEX_SIZE

    // Scale to fit canvas minus padding
    const drawSize = CANVAS_SIZE - PADDING * 2
    const scale = drawSize / (2 * Math.max(worldExtentX, worldExtentZ))

    // Center of draw area
    const cx = CANVAS_SIZE / 2
    const cy = CANVAS_SIZE / 2

    ctx.fillStyle = '#0a0604'
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

    // Draw hex cells
    for (const cell of hexGrid.getAllCells()) {
      const [wx, wz] = hexToWorld(cell.q, cell.r)
      const px = cx + wx * scale
      const py = cy + wz * scale

      // Color: user type overlay or terrain
      const [r, g, b] = TERRAIN_COLORS[cell.terrainType]
      let fillColor = `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`
      if (cell.userType && cell.userType !== 'empty') {
        fillColor = USER_COLORS[cell.userType] ?? fillColor
      }

      // Hex polygon scaled to minimap
      const corners = hexCorners(0, 0, HEX_SIZE * scale * 0.95)
      ctx.beginPath()
      ctx.moveTo(px + corners[0][0], py + corners[0][1])
      for (let i = 1; i < 6; i++) ctx.lineTo(px + corners[i][0], py + corners[i][1])
      ctx.closePath()
      ctx.fillStyle = fillColor
      ctx.globalAlpha = cell.userType && cell.userType !== 'empty' ? 0.9 : 0.85
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // Spawn points — use hexToWorld for correct position
    for (const spawn of spawnPoints) {
      const [wx, wz] = hexToWorld(spawn.pos[0], spawn.pos[1])
      const px = cx + wx * scale
      const py = cy + wz * scale
      const color = PLAYER_COLORS[(spawn.player - 1) % 4]
      ctx.beginPath()
      ctx.arc(px, py, 4, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 6px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(spawn.player), px, py)
    }

    // Border
    ctx.strokeStyle = '#3a2010'
    ctx.lineWidth = 1
    ctx.strokeRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
  }, [hexGrid, buildNodes, resourceNodes, spawnPoints])

  return (
    <div className="absolute bottom-3 left-3 z-10 rounded overflow-hidden border border-zinc-700 shadow-lg">
      <div className="bg-zinc-900/80 px-1.5 py-0.5 text-xs text-zinc-500 font-mono border-b border-zinc-700">
        minimap
      </div>
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className="block"
      />
    </div>
  )
}

export default Minimap
