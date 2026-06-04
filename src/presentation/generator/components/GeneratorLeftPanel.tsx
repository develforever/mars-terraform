import { useState } from 'react'
import { useMapEditorStore } from '../../../application/store/useMapEditorStore'
import type { ToolMode, BrushSize } from '../../../domain/mapEditorTypes'
import type { HexTerrainType } from '../hex/HexGrid'

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS: { mode: ToolMode; label: string; key: string; color: string }[] = [
  { mode: 'select',   label: '↖ Select',   key: 'V', color: 'text-zinc-300' },
  { mode: 'terrain',  label: '🗺 Terrain',  key: 'T', color: 'text-orange-400' },
  { mode: 'build',    label: '🏗 Build',    key: 'B', color: 'text-green-400' },
  { mode: 'resource', label: '💎 Resource', key: 'R', color: 'text-yellow-400' },
  { mode: 'blocked',  label: '🚫 Blocked',  key: 'X', color: 'text-red-400' },
  { mode: 'spawn',    label: '🚩 Spawn',    key: 'S', color: 'text-blue-400' },
  { mode: 'erase',    label: '🗑 Erase',    key: 'E', color: 'text-zinc-400' },
]

const BRUSHES: BrushSize[] = [1, 3, 5]

// ─── Terrain type definitions ─────────────────────────────────────────────────

const TERRAIN_TYPES: { type: HexTerrainType; label: string; color: string }[] = [
  { type: 'deep_crater', label: 'Deep Crater', color: '#3d1f0a' },
  { type: 'lowland',     label: 'Lowland',     color: '#8b3a1a' },
  { type: 'plains',      label: 'Plains',      color: '#c1440e' },
  { type: 'highland',    label: 'Highland',    color: '#d4622a' },
  { type: 'rocky',       label: 'Rocky',       color: '#6b4c32' },
  { type: 'peak',        label: 'Peak',        color: '#9e8060' },
]

// ─── Component ────────────────────────────────────────────────────────────────

const GeneratorLeftPanel = () => {
  const activeTool        = useMapEditorStore(s => s.activeTool)
  const brushSize         = useMapEditorStore(s => s.brushSize)
  const activeTerrainType = useMapEditorStore(s => s.activeTerrainType)
  const hexRadius         = useMapEditorStore(s => s.hexRadius)
  const hexSeed           = useMapEditorStore(s => s.hexSeed)
  const setActiveTool     = useMapEditorStore(s => s.setActiveTool)
  const setBrushSize      = useMapEditorStore(s => s.setBrushSize)
  const setActiveTerrainType = useMapEditorStore(s => s.setActiveTerrainType)
  const generateHexGrid   = useMapEditorStore(s => s.generateHexGrid)

  const [radiusInput, setRadiusInput] = useState<number>(hexRadius)
  const [seedInput, setSeedInput]     = useState<number>(hexSeed)

  const handleGenerate = () => {
    const r = Math.max(5, Math.min(40, radiusInput))
    generateHexGrid(r, seedInput)
  }

  const handleRandomSeed = () => {
    const s = Math.floor(Math.random() * 99999)
    setSeedInput(s)
  }

  return (
    <div className="flex flex-col gap-1 p-2 bg-zinc-900 border-r border-zinc-700 w-full h-full select-none overflow-y-auto">

      {/* Tools */}
      <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1 px-1">Tools</p>
      {TOOLS.map(t => (
        <button
          key={t.mode}
          onClick={() => setActiveTool(t.mode)}
          className={`
            flex items-center justify-between px-2 py-1.5 rounded text-sm font-medium transition-colors
            ${activeTool === t.mode
              ? 'bg-orange-600 text-white'
              : 'hover:bg-zinc-700 text-zinc-300'}
          `}
        >
          <span className={activeTool === t.mode ? 'text-white' : t.color}>{t.label}</span>
          <span className="text-xs text-zinc-500 font-mono">{t.key}</span>
        </button>
      ))}

      {/* Brush size */}
      <div className="border-t border-zinc-700 mt-2 pt-2">
        <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1 px-1">Brush</p>
        <div className="flex gap-1">
          {BRUSHES.map(b => (
            <button
              key={b}
              onClick={() => setBrushSize(b)}
              className={`
                flex-1 py-1 rounded text-xs font-mono font-medium transition-colors
                ${brushSize === b
                  ? 'bg-orange-600 text-white'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'}
              `}
            >
              {b}×{b}
            </button>
          ))}
        </div>
      </div>

      {/* Terrain type picker — visible when terrain tool active */}
      {activeTool === 'terrain' && (
        <div className="border-t border-zinc-700 mt-2 pt-2">
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1 px-1">Terrain Type</p>
          {TERRAIN_TYPES.map(tt => (
            <button
              key={tt.type}
              onClick={() => setActiveTerrainType(tt.type)}
              className={`
                w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs font-medium transition-colors mb-0.5
                ${activeTerrainType === tt.type
                  ? 'bg-zinc-700 text-white ring-1 ring-orange-500'
                  : 'hover:bg-zinc-800 text-zinc-300'}
              `}
            >
              <span
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: tt.color }}
              />
              {tt.label}
            </button>
          ))}
        </div>
      )}

      {/* Map generation */}
      <div className="border-t border-zinc-700 mt-2 pt-2">
        <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2 px-1">Map</p>

        <label className="flex flex-col gap-0.5 mb-2">
          <span className="text-xs text-zinc-500">Radius: {radiusInput}</span>
          <input
            type="range"
            min={5}
            max={40}
            value={radiusInput}
            onChange={e => setRadiusInput(Number(e.target.value))}
            className="accent-orange-500 w-full"
          />
          <div className="flex justify-between text-xs text-zinc-600">
            <span>5</span><span>40</span>
          </div>
        </label>

        <div className="flex items-end gap-1 mb-2">
          <label className="flex flex-col gap-0.5 flex-1">
            <span className="text-xs text-zinc-500">Seed</span>
            <input
              type="number"
              value={seedInput}
              onChange={e => setSeedInput(Number(e.target.value))}
              className="bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-xs text-zinc-200 w-full focus:outline-none focus:border-orange-500"
            />
          </label>
          <button
            onClick={handleRandomSeed}
            title="Random seed"
            className="px-1.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-400 mb-0.5"
          >
            🎲
          </button>
        </div>

        <button
          onClick={handleGenerate}
          className="w-full py-2 rounded bg-orange-700 hover:bg-orange-600 text-white text-xs font-semibold transition-colors"
        >
          ⟳ Generate Map
        </button>
      </div>
    </div>
  )
}

export default GeneratorLeftPanel
