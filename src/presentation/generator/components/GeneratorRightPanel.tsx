import { useState, useEffect } from 'react'
import { useMapEditorStore } from '../../../application/store/useMapEditorStore'
import type { BuildingType, ResourceType, Richness } from '../../../domain/mapEditorTypes'
import type { HexTerrainType } from '../hex/HexGrid'

type Tab = 'settings' | 'inspector' | 'json'

// ─── Building / Resource type options ────────────────────────────────────────

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

const TERRAIN_TYPES: { value: HexTerrainType; label: string; color: string }[] = [
  { value: 'deep_crater', label: 'Deep Crater', color: '#3d1f0a' },
  { value: 'lowland',     label: 'Lowland',     color: '#8b3a1a' },
  { value: 'plains',      label: 'Plains',      color: '#c1440e' },
  { value: 'highland',    label: 'Highland',    color: '#d4622a' },
  { value: 'rocky',       label: 'Rocky',       color: '#6b4c32' },
  { value: 'peak',        label: 'Peak',        color: '#9e8060' },
]

// ─── Hex Inspector ────────────────────────────────────────────────────────────

const HexInspector = ({ q, r }: { q: number; r: number }) => {
  const hexGrid = useMapEditorStore(s => s.hexGrid)
  const setHexTerrainType = useMapEditorStore(s => s.setHexTerrainType)

  const cell = hexGrid?.getCell(q, r)
  if (!cell) return (
    <p className="text-zinc-500 text-xs text-center mt-4">Hex not found.</p>
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs font-mono text-zinc-400 border-b border-zinc-700 pb-2">
        Hex <span className="text-[#ec7063]">({q}, {r})</span>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-zinc-400">Terrain type</span>
        <select
          className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:border-[#e74c3c]"
          value={cell.terrainType}
          onChange={e => setHexTerrainType(q, r, e.target.value as HexTerrainType)}
        >
          {TERRAIN_TYPES.map(tt => (
            <option key={tt.value} value={tt.value}>{tt.label}</option>
          ))}
        </select>
      </label>

      {cell.decor && (
        <div className="text-xs text-zinc-500 font-mono">
          decor: {cell.decor}
        </div>
      )}
    </div>
  )
}

// ─── Build Node Inspector ─────────────────────────────────────────────────────

const BuildNodeInspector = ({ nodeId }: { nodeId: string }) => {
  const node = useMapEditorStore(s => s.buildNodes.find(n => n.id === nodeId))
  const updateBuildNode  = useMapEditorStore(s => s.updateBuildNode)
  const removeBuildNode  = useMapEditorStore(s => s.removeBuildNode)
  const setSelectedNodeId = useMapEditorStore(s => s.setSelectedNodeId)

  if (!node) return <p className="text-zinc-500 text-xs text-center mt-4">Node not found.</p>

  const toggleType = (type: BuildingType) => {
    const next = node.allowedTypes.includes(type)
      ? node.allowedTypes.filter(t => t !== type)
      : [...node.allowedTypes, type]
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

      <div className="flex flex-col gap-1">
        <span className="text-xs text-zinc-400">Allowed building types</span>
        {BUILDING_TYPES.map(bt => (
          <label key={bt.value} className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={node.allowedTypes.includes(bt.value)}
              onChange={() => toggleType(bt.value)}
              className="accent-[#e74c3c]"
            />
            <span className="text-xs text-zinc-300 group-hover:text-white transition-colors">
              {bt.label}
            </span>
          </label>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-zinc-400">Footprint</span>
        <div className="flex gap-1">
          {[1, 2, 3].map(n => (
            <button
              key={n}
              onClick={() => updateBuildNode(nodeId, { footprint: [n, n] })}
              className={`flex-1 py-1 rounded text-xs font-mono transition-colors
                ${node.footprint[0] === n
                  ? 'bg-[#e74c3c] text-white'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'}`}
            >
              {n}×{n}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-zinc-700 pt-2">
        <span className="text-xs text-zinc-400">Position (q, r)</span>
        <div className="flex gap-1 mt-1">
          <input type="number" value={node.pos[0]}
            onChange={e => updateBuildNode(nodeId, { pos: [Number(e.target.value), node.pos[1]] })}
            className="w-1/2 bg-zinc-800 border border-zinc-600 rounded px-1 py-0.5 text-xs text-zinc-100 focus:outline-none focus:border-[#e74c3c]" />
          <input type="number" value={node.pos[1]}
            onChange={e => updateBuildNode(nodeId, { pos: [node.pos[0], Number(e.target.value)] })}
            className="w-1/2 bg-zinc-800 border border-zinc-600 rounded px-1 py-0.5 text-xs text-zinc-100 focus:outline-none focus:border-[#e74c3c]" />
        </div>
      </div>
    </div>
  )
}

// ─── Resource Node Inspector ──────────────────────────────────────────────────

const ResourceNodeInspector = ({ nodeId }: { nodeId: string }) => {
  const node = useMapEditorStore(s => s.resourceNodes.find(n => n.id === nodeId))
  const updateResourceNode = useMapEditorStore(s => s.updateResourceNode)
  const removeResourceNode = useMapEditorStore(s => s.removeResourceNode)
  const setSelectedNodeId  = useMapEditorStore(s => s.setSelectedNodeId)

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
          className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:border-[#e74c3c]"
          value={node.type}
          onChange={e => updateResourceNode(nodeId, { type: e.target.value as ResourceType })}
        >
          {RESOURCE_TYPES.map(rt => <option key={rt.value} value={rt.value}>{rt.label}</option>)}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-zinc-400">Amount: {node.amount}</span>
        <input
          type="range" min={100} max={5000} step={100} value={node.amount}
          onChange={e => updateResourceNode(nodeId, { amount: Number(e.target.value) })}
          className="accent-[#e74c3c]"
        />
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
                  ? 'bg-[#e74c3c] text-white'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'}`}
            >
              {r}
            </button>
          ))}
        </div>
      </label>

      <div className="border-t border-zinc-700 pt-2">
        <span className="text-xs text-zinc-400">Position (q, r)</span>
        <div className="flex gap-1 mt-1">
          <input type="number" value={node.pos[0]}
            onChange={e => updateResourceNode(nodeId, { pos: [Number(e.target.value), node.pos[1]] })}
            className="w-1/2 bg-zinc-800 border border-zinc-600 rounded px-1 py-0.5 text-xs text-zinc-100 focus:outline-none focus:border-[#e74c3c]" />
          <input type="number" value={node.pos[1]}
            onChange={e => updateResourceNode(nodeId, { pos: [node.pos[0], Number(e.target.value)] })}
            className="w-1/2 bg-zinc-800 border border-zinc-600 rounded px-1 py-0.5 text-xs text-zinc-100 focus:outline-none focus:border-[#e74c3c]" />
        </div>
      </div>
    </div>
  )
}

// ─── Spawn Inspector ──────────────────────────────────────────────────────────

const SpawnInspector = ({ spawnKey }: { spawnKey: string }) => {
  const player = parseInt(spawnKey.replace('spawn-', ''))
  const spawn  = useMapEditorStore(s => s.spawnPoints.find(s => s.player === player))
  const removeSpawnPoint  = useMapEditorStore(s => s.removeSpawnPoint)
  const addSpawnPoint     = useMapEditorStore(s => s.addSpawnPoint)
  const setSelectedNodeId = useMapEditorStore(s => s.setSelectedNodeId)

  if (!spawn) return null
  const PLAYER_COLORS = ['#4488ff', '#ff4444', '#44ff88', '#ffaa00']
  const color = PLAYER_COLORS[(spawn.player - 1) % 4]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold" style={{ color }}>🚩 Player {spawn.player} Spawn</span>
        <button
          onClick={() => { removeSpawnPoint(spawn.player); setSelectedNodeId(null) }}
          className="text-xs text-red-500 hover:text-red-400 px-1"
        >
          🗑 Remove
        </button>
      </div>
      <div className="border-t border-zinc-700 pt-2">
        <span className="text-xs text-zinc-400">Position (q, r)</span>
        <div className="flex gap-1 mt-1">
          <input type="number" value={spawn.pos[0]}
            onChange={e => addSpawnPoint({ player: spawn.player, pos: [Number(e.target.value), spawn.pos[1]] })}
            className="w-1/2 bg-zinc-800 border border-zinc-600 rounded px-1 py-0.5 text-xs text-zinc-100 focus:outline-none focus:border-[#e74c3c]" />
          <input type="number" value={spawn.pos[1]}
            onChange={e => addSpawnPoint({ player: spawn.player, pos: [spawn.pos[0], Number(e.target.value)] })}
            className="w-1/2 bg-zinc-800 border border-zinc-600 rounded px-1 py-0.5 text-xs text-zinc-100 focus:outline-none focus:border-[#e74c3c]" />
        </div>
      </div>
    </div>
  )
}

// ─── Right Panel ──────────────────────────────────────────────────────────────

const GeneratorRightPanel = () => {
  const [activeTab, setActiveTab] = useState<Tab>('settings')

  const meta           = useMapEditorStore(s => s.meta)
  const updateMeta     = useMapEditorStore(s => s.updateMeta)
  const exportToJSON   = useMapEditorStore(s => s.exportToJSON)
  const selectedNodeId = useMapEditorStore(s => s.selectedNodeId)
  const selectedHex    = useMapEditorStore(s => s.selectedHex)
  const buildNodes     = useMapEditorStore(s => s.buildNodes)
  const resourceNodes  = useMapEditorStore(s => s.resourceNodes)
  const spawnPoints    = useMapEditorStore(s => s.spawnPoints)
  const hexGrid        = useMapEditorStore(s => s.hexGrid)
  const hexRadius      = useMapEditorStore(s => s.hexRadius)

  const hasInspector = !!(selectedNodeId || selectedHex)

  // Auto-switch to inspector when something is selected, but don't lock the tab
  useEffect(() => {
    if (hasInspector) setActiveTab('inspector')
  }, [hasInspector])

  const effectiveTab = activeTab

  // Terrain stats from hexGrid
  const terrainStats = hexGrid?.getTerrainStats()
  const totalHexes   = hexGrid?.getCellCount() ?? 0

  const jsonPreview = JSON.stringify(exportToJSON(), null, 2)

  const renderInspector = () => {
    if (selectedHex && !selectedNodeId) {
      return <HexInspector q={selectedHex.q} r={selectedHex.r} />
    }
    if (!selectedNodeId) {
      return (
        <div className="text-zinc-500 text-xs text-center mt-8 px-2">
          <p>Select a hex or node on the map</p>
          <p className="mt-1 text-zinc-600">
            Use <span className="text-[#ec7063]">↖ Select</span> tool then click
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
                ? 'bg-zinc-800 text-[#ec7063] border-b-2 border-[#e74c3c]'
                : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            {tab}
            {tab === 'inspector' && hasInspector && (
              <span className="ml-1 w-1.5 h-1.5 rounded-full bg-[#e74c3c] inline-block" />
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
                className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:border-[#e74c3c]"
                value={meta.name}
                onChange={e => updateMeta({ name: e.target.value })}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-zinc-400">Description</span>
              <textarea
                className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:border-[#e74c3c] resize-none"
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
                        ? 'bg-[#e74c3c] text-white'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </label>

            {/* Map info */}
            <div className="border-t border-zinc-700 pt-3 mt-1">
              <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2">Map info</p>
              <div className="flex justify-between py-0.5">
                <span className="text-xs text-zinc-400">Radius</span>
                <span className="text-xs font-mono text-zinc-300">{hexRadius}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-xs text-zinc-400">Total hexes</span>
                <span className="text-xs font-mono text-zinc-300">{totalHexes}</span>
              </div>
            </div>

            {/* Terrain stats */}
            {terrainStats && (
              <div className="border-t border-zinc-700 pt-3">
                <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2">Terrain</p>
                {Object.entries(terrainStats).map(([type, count]) => count > 0 && (
                  <div key={type} className="flex justify-between py-0.5">
                    <span className="text-xs text-zinc-400 capitalize">{type.replace('_', ' ')}</span>
                    <span className="text-xs font-mono text-zinc-300">{count}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Node counts */}
            <div className="border-t border-zinc-700 pt-3">
              <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2">Nodes</p>
              {([
                ['Build',    buildNodes.length,    'text-green-400'],
                ['Resource', resourceNodes.length, 'text-yellow-400'],
                ['Spawn',    spawnPoints.length,   'text-blue-400'],
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
