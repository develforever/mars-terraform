import { useState } from 'react'
import { useMapEditorStore } from '../../../application/store/useMapEditorStore'
import type { BuildingType, ResourceType, Richness } from '../../../domain/mapEditorTypes'

type Tab = 'settings' | 'inspector' | 'json'

// ─── Building type options ────────────────────────────────────────────────────

const BUILDING_TYPES: { value: BuildingType; label: string }[] = [
  { value: 'colony',            label: '🏠 Colony' },
  { value: 'oxygen_generator',  label: '💨 Oxygen Generator' },
  { value: 'greenhouse',        label: '🌿 Greenhouse' },
  { value: 'solar_power',       label: '☀️ Solar Power' },
  { value: 'extractor',         label: '⛏ Extractor' },
]

const RESOURCE_TYPES: { value: ResourceType; label: string }[] = [
  { value: 'minerals', label: '⛏ Minerals' },
  { value: 'ice',      label: '🧊 Ice' },
  { value: 'organics', label: '🌿 Organics' },
  { value: 'energy',   label: '⚡ Energy' },
]

// ─── Build Node Inspector ─────────────────────────────────────────────────────

const BuildNodeInspector = ({ nodeId }: { nodeId: string }) => {
  const node = useMapEditorStore(s => s.buildNodes.find(n => n.id === nodeId))
  const updateBuildNode = useMapEditorStore(s => s.updateBuildNode)
  const removeBuildNode = useMapEditorStore(s => s.removeBuildNode)
  const setSelectedNodeId = useMapEditorStore(s => s.setSelectedNodeId)

  if (!node) return <p className="text-zinc-500 text-xs text-center mt-4">Node not found.</p>

  const toggleType = (type: BuildingType) => {
    const current = node.allowedTypes
    const next = current.includes(type)
      ? current.filter(t => t !== type)
      : [...current, type]
    if (next.length > 0) updateBuildNode(nodeId, { allowedTypes: next })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-400 font-mono">{node.id}</span>
        <button
          onClick={() => { removeBuildNode(nodeId); setSelectedNodeId(null) }}
          className="text-xs text-red-500 hover:text-red-400 px-1"
        >
          🗑 Remove
        </button>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-zinc-400">Footprint size (tiles)</span>
        <div className="flex gap-1">
          {([1, 2, 3, 4, 5] as const).map(s => (
            <button
              key={s}
              onClick={() => updateBuildNode(nodeId, { footprint: [s, s] })}
              className={`flex-1 py-1 rounded text-xs font-mono transition-colors
                ${node.footprint[0] === s
                  ? 'bg-orange-600 text-white'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-zinc-400">Allowed building types</span>
        {BUILDING_TYPES.map(bt => (
          <label key={bt.value} className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={node.allowedTypes.includes(bt.value)}
              onChange={() => toggleType(bt.value)}
              className="accent-orange-500"
            />
            <span className="text-xs text-zinc-300 group-hover:text-white transition-colors">
              {bt.label}
            </span>
          </label>
        ))}
      </div>

      <div className="text-xs text-zinc-500 font-mono border-t border-zinc-700 pt-2">
        pos: [{node.pos[0]}, {node.pos[1]}]
      </div>
    </div>
  )
}

// ─── Resource Node Inspector ──────────────────────────────────────────────────

const ResourceNodeInspector = ({ nodeId }: { nodeId: string }) => {
  const node = useMapEditorStore(s => s.resourceNodes.find(n => n.id === nodeId))
  const updateResourceNode = useMapEditorStore(s => s.updateResourceNode)
  const removeResourceNode = useMapEditorStore(s => s.removeResourceNode)
  const setSelectedNodeId = useMapEditorStore(s => s.setSelectedNodeId)

  if (!node) return <p className="text-zinc-500 text-xs text-center mt-4">Node not found.</p>

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-400 font-mono">{node.id}</span>
        <button
          onClick={() => { removeResourceNode(nodeId); setSelectedNodeId(null) }}
          className="text-xs text-red-500 hover:text-red-400 px-1"
        >
          🗑 Remove
        </button>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-zinc-400">Resource type</span>
        <select
          className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:border-orange-500"
          value={node.type}
          onChange={e => updateResourceNode(nodeId, { type: e.target.value as ResourceType })}
        >
          {RESOURCE_TYPES.map(rt => (
            <option key={rt.value} value={rt.value}>{rt.label}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-zinc-400">Amount: {node.amount}</span>
        <input
          type="range"
          min={100}
          max={5000}
          step={100}
          value={node.amount}
          onChange={e => updateResourceNode(nodeId, { amount: Number(e.target.value) })}
          className="accent-orange-500"
        />
        <div className="flex justify-between text-xs text-zinc-600">
          <span>100</span><span>5000</span>
        </div>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-zinc-400">Richness</span>
        <div className="flex gap-1">
          {(['low', 'med', 'high'] as Richness[]).map(r => (
            <button
              key={r}
              onClick={() => updateResourceNode(nodeId, { richness: r })}
              className={`flex-1 py-1 rounded text-xs font-mono capitalize transition-colors
                ${node.richness === r
                  ? 'bg-orange-600 text-white'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'}`}
            >
              {r}
            </button>
          ))}
        </div>
      </label>

      <div className="text-xs text-zinc-500 font-mono border-t border-zinc-700 pt-2">
        pos: [{node.pos[0]}, {node.pos[1]}]
      </div>
    </div>
  )
}

// ─── Spawn Inspector ──────────────────────────────────────────────────────────

const SpawnInspector = ({ spawnKey }: { spawnKey: string }) => {
  const player = parseInt(spawnKey.replace('spawn-', ''))
  const spawn = useMapEditorStore(s => s.spawnPoints.find(s => s.player === player))
  const removeSpawnPoint = useMapEditorStore(s => s.removeSpawnPoint)
  const setSelectedNodeId = useMapEditorStore(s => s.setSelectedNodeId)

  if (!spawn) return null
  const PLAYER_COLORS = ['#4488ff', '#ff4444', '#44ff88', '#ffaa00']
  const color = PLAYER_COLORS[(spawn.player - 1) % 4]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold" style={{ color }}>
          🚩 Player {spawn.player} Spawn
        </span>
        <button
          onClick={() => { removeSpawnPoint(spawn.player); setSelectedNodeId(null) }}
          className="text-xs text-red-500 hover:text-red-400 px-1"
        >
          🗑 Remove
        </button>
      </div>
      <div className="text-xs text-zinc-500 font-mono border-t border-zinc-700 pt-2">
        pos: [{spawn.pos[0]}, {spawn.pos[1]}]
      </div>
    </div>
  )
}

// ─── Right Panel ──────────────────────────────────────────────────────────────

const GeneratorRightPanel = () => {
  const [activeTab, setActiveTab] = useState<Tab>('settings')
  const meta = useMapEditorStore(s => s.meta)
  const updateMeta = useMapEditorStore(s => s.updateMeta)
  const exportToJSON = useMapEditorStore(s => s.exportToJSON)
  const tiles = useMapEditorStore(s => s.tiles)
  const selectedNodeId = useMapEditorStore(s => s.selectedNodeId)
  const buildNodes = useMapEditorStore(s => s.buildNodes)
  const resourceNodes = useMapEditorStore(s => s.resourceNodes)

  // Auto-switch to inspector tab when something is selected
  const effectiveTab = selectedNodeId ? 'inspector' : activeTab

  // Tile stats
  const stats = { build: 0, resource: 0, blocked: 0, spawn: 0, empty: 0 }
  for (const v of tiles) {
    if (v === 1) stats.build++
    else if (v === 2) stats.resource++
    else if (v === 3) stats.blocked++
    else if (v === 4) stats.spawn++
    else stats.empty++
  }

  const jsonPreview = JSON.stringify(exportToJSON(), null, 2)

  const renderInspector = () => {
    if (!selectedNodeId) {
      return (
        <div className="text-zinc-500 text-xs text-center mt-8 px-2">
          <p>Select a node on the map</p>
          <p className="mt-1 text-zinc-600">
            Use <span className="text-orange-400">↖ Select</span> tool then click a marker
          </p>
          <div className="mt-4 border-t border-zinc-800 pt-4 text-left">
            <p className="text-zinc-400 mb-2">Nodes placed:</p>
            <p className="text-green-500">🏗 Build nodes: {buildNodes.length}</p>
            <p className="text-yellow-500">💎 Resource nodes: {resourceNodes.length}</p>
          </div>
        </div>
      )
    }
    if (selectedNodeId.startsWith('spawn-')) return <SpawnInspector spawnKey={selectedNodeId} />
    if (selectedNodeId.startsWith('b')) return <BuildNodeInspector nodeId={selectedNodeId} />
    if (selectedNodeId.startsWith('r')) return <ResourceNodeInspector nodeId={selectedNodeId} />
    return null
  }

  return (
    <div className="flex flex-col bg-zinc-900 border-l border-zinc-700 w-full h-full text-zinc-200 text-sm">
      {/* Tabs */}
      <div className="flex border-b border-zinc-700">
        {(['settings', 'inspector', 'json'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-xs uppercase tracking-wider font-medium transition-colors
              ${effectiveTab === tab
                ? 'bg-zinc-800 text-orange-400 border-b-2 border-orange-500'
                : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            {tab}
            {tab === 'inspector' && selectedNodeId && (
              <span className="ml-1 w-1.5 h-1.5 rounded-full bg-orange-500 inline-block" />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">

        {/* ── Settings ── */}
        {effectiveTab === 'settings' && (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-zinc-400">Map name</span>
              <input
                className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:border-orange-500"
                value={meta.name}
                onChange={e => updateMeta({ name: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-zinc-400">Description</span>
              <textarea
                className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:border-orange-500 resize-none"
                rows={3}
                value={meta.description}
                onChange={e => updateMeta({ description: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-zinc-400">Players (1–4)</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(p => (
                  <button
                    key={p}
                    onClick={() => updateMeta({ players: p })}
                    className={`flex-1 py-1 rounded text-xs font-mono transition-colors
                      ${meta.players === p
                        ? 'bg-orange-600 text-white'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </label>

            {/* Tile stats */}
            <div className="border-t border-zinc-700 pt-3 mt-1">
              <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2">Tile stats</p>
              {([
                ['Build',    stats.build,    'text-green-400'],
                ['Resource', stats.resource, 'text-yellow-400'],
                ['Blocked',  stats.blocked,  'text-red-400'],
                ['Spawn',    stats.spawn,    'text-blue-400'],
                ['Empty',    stats.empty,    'text-zinc-500'],
              ] as [string, number, string][]).map(([label, count, cls]) => (
                <div key={label} className="flex justify-between py-0.5">
                  <span className={`text-xs ${cls}`}>{label}</span>
                  <span className="text-xs font-mono text-zinc-300">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Inspector ── */}
        {effectiveTab === 'inspector' && renderInspector()}

        {/* ── JSON ── */}
        {effectiveTab === 'json' && (
          <pre className="text-xs text-green-300 font-mono whitespace-pre-wrap break-all leading-relaxed">
            {jsonPreview}
          </pre>
        )}
      </div>
    </div>
  )
}

export default GeneratorRightPanel
