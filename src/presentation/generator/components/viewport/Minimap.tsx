import { useEffect, useRef } from 'react'
import { useMapEditorStore } from '../../../../application/store/useMapEditorStore'

const MAP_SIZE = 100
const CANVAS_SIZE = 180

const TILE_COLORS: Record<number, string> = {
  0: '#1a0e08',
  1: '#00cc66',
  2: '#ccaa00',
  3: '#cc2200',
  4: '#2266ff',
}

const Minimap = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const tiles = useMapEditorStore(s => s.tiles)
  const buildNodes = useMapEditorStore(s => s.buildNodes)
  const resourceNodes = useMapEditorStore(s => s.resourceNodes)
  const spawnPoints = useMapEditorStore(s => s.spawnPoints)

  const PLAYER_COLORS = ['#4488ff', '#ff4444', '#44ff88', '#ffaa00']

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const cellSize = CANVAS_SIZE / MAP_SIZE

    // Background
    ctx.fillStyle = '#0a0604'
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

    // Tiles
    for (let z = 0; z < MAP_SIZE; z++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        const val = tiles[z * MAP_SIZE + x]
        if (val === 0) continue
        ctx.fillStyle = TILE_COLORS[val] ?? '#333'
        ctx.globalAlpha = 0.7
        ctx.fillRect(x * cellSize, z * cellSize, cellSize, cellSize)
      }
    }
    ctx.globalAlpha = 1

    // Build node markers
    for (const node of buildNodes) {
      const [tx, tz] = node.pos
      const px = tx * cellSize
      const pz = tz * cellSize
      ctx.strokeStyle = '#00ff88'
      ctx.lineWidth = 1
      ctx.strokeRect(px, pz, node.footprint[0] * cellSize, node.footprint[1] * cellSize)
    }

    // Resource node markers
    for (const node of resourceNodes) {
      const [tx, tz] = node.pos
      const px = (tx + 0.5) * cellSize
      const pz = (tz + 0.5) * cellSize
      ctx.beginPath()
      ctx.arc(px, pz, cellSize * 1.2, 0, Math.PI * 2)
      ctx.fillStyle = '#ffcc00'
      ctx.fill()
    }

    // Spawn points
    for (const spawn of spawnPoints) {
      const [tx, tz] = spawn.pos
      const px = (tx + 0.5) * cellSize
      const pz = (tz + 0.5) * cellSize
      const color = PLAYER_COLORS[(spawn.player - 1) % 4]
      ctx.beginPath()
      ctx.arc(px, pz, cellSize * 1.8, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.font = `bold ${Math.max(6, cellSize * 2.5)}px monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(spawn.player), px, pz)
    }

    // Border
    ctx.strokeStyle = '#3a2010'
    ctx.lineWidth = 1
    ctx.strokeRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
  }, [tiles, buildNodes, resourceNodes, spawnPoints])

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
