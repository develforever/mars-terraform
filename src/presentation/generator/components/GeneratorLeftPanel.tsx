import { useState } from 'react'
import { useMapEditorStore } from '../../../application/store/useMapEditorStore'
import type { ToolMode, BrushSize } from '../../../domain/mapEditorTypes'
import type { ScatterOptions } from '../../../application/store/useMapEditorStore'

const TOOLS: { mode: ToolMode; label: string; key: string; color: string }[] = [
  { mode: 'select',   label: '↖ Select',   key: 'V', color: 'text-zinc-300' },
  { mode: 'build',    label: '🏗 Build',    key: 'B', color: 'text-green-400' },
  { mode: 'resource', label: '💎 Resource', key: 'R', color: 'text-yellow-400' },
  { mode: 'blocked',  label: '🚫 Blocked',  key: 'X', color: 'text-red-400' },
  { mode: 'spawn',    label: '🚩 Spawn',    key: 'S', color: 'text-blue-400' },
  { mode: 'erase',    label: '🗑 Erase',    key: 'E', color: 'text-zinc-400' },
]

const BRUSHES: BrushSize[] = [1, 3, 5]

const DEFAULT_SCATTER: ScatterOptions = {
  rocks: 40,
  minerals: 8,
  ice: 4,
  organics: 3,
  energy: 3,
  clearExisting: false,
  seed: 42,
}

const GeneratorLeftPanel = () => {
  const activeTool = useMapEditorStore(s => s.activeTool)
  const brushSize = useMapEditorStore(s => s.brushSize)
  const setActiveTool = useMapEditorStore(s => s.setActiveTool)
  const setBrushSize = useMapEditorStore(s => s.setBrushSize)
  const autoScatter = useMapEditorStore(s => s.autoScatter)

  const [scatterOpen, setScatterOpen] = useState(false)
  const [opts, setOpts] = useState<ScatterOptions>(DEFAULT_SCATTER)

  const setOpt = <K extends keyof ScatterOptions>(key: K, val: ScatterOptions[K]) =>
    setOpts(o => ({ ...o, [key]: val }))

  const handleScatter = () => {
    autoScatter(opts)
  }

  const handleRandomSeed = () => {
    setOpt('seed', Math.floor(Math.random() * 99999))
  }

  return (
    <div className="flex flex-col gap-1 p-2 bg-zinc-900 border-r border-zinc-700 w-full h-full select-none overflow-y-auto">
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

      {/* Auto-scatter */}
      <div className="border-t border-zinc-700 mt-2 pt-2">
        <button
          onClick={() => setScatterOpen(o => !o)}
          className="w-full flex items-center justify-between px-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <span className="uppercase tracking-widest">🎲 Auto-scatter</span>
          <span>{scatterOpen ? '▲' : '▼'}</span>
        </button>

        {scatterOpen && (
          <div className="mt-2 flex flex-col gap-2">
            {/* Rocks */}
            <label className="flex flex-col gap-0.5">
              <span className="text-xs text-zinc-500">🪨 Rocks: {opts.rocks}</span>
              <input type="range" min={0} max={150} value={opts.rocks}
                onChange={e => setOpt('rocks', Number(e.target.value))}
                className="accent-orange-500 w-full" />
            </label>

            {/* Resources */}
            {(['minerals','ice','organics','energy'] as const).map(type => {
              const icons: Record<string, string> = { minerals:'⛏', ice:'🧊', organics:'🌿', energy:'⚡' }
              return (
                <label key={type} className="flex flex-col gap-0.5">
                  <span className="text-xs text-zinc-500">{icons[type]} {type}: {opts[type]}</span>
                  <input type="range" min={0} max={20} value={opts[type]}
                    onChange={e => setOpt(type, Number(e.target.value))}
                    className="accent-orange-500 w-full" />
                </label>
              )
            })}

            {/* Seed */}
            <div className="flex items-center gap-1">
              <label className="flex flex-col gap-0.5 flex-1">
                <span className="text-xs text-zinc-500">Seed</span>
                <input
                  type="number"
                  value={opts.seed}
                  onChange={e => setOpt('seed', Number(e.target.value))}
                  className="bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-xs text-zinc-200 w-full focus:outline-none focus:border-orange-500"
                />
              </label>
              <button
                onClick={handleRandomSeed}
                className="mt-4 px-1.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-400"
                title="Random seed"
              >🎲</button>
            </div>

            {/* Clear existing */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={opts.clearExisting}
                onChange={e => setOpt('clearExisting', e.target.checked)}
                className="accent-orange-500"
              />
              <span className="text-xs text-zinc-400">Clear existing</span>
            </label>

            <button
              onClick={handleScatter}
              className="w-full py-1.5 rounded bg-orange-700 hover:bg-orange-600 text-white text-xs font-medium transition-colors"
            >
              🎲 Scatter!
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default GeneratorLeftPanel
