import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useMapEditorStore } from '../../../application/store/useMapEditorStore'
import {
  AIMapGeneratorService,
  type AIMapGenerationResult,
} from '../../../domain/services/AIMapGeneratorService'
import type { HexTerrainType } from '../hex/HexGrid'

interface AIAssistantModalProps {
  onClose: () => void
}

interface TemplatePrompt {
  labelKey: string
  promptText: string
  mode: 'new' | 'modify'
}

const TEMPLATES: TemplatePrompt[] = [
  {
    labelKey: 'modal.aiAssistant.templateIceCrater',
    promptText: 'Krater lodowy z potężnymi złożami wody, otoczony mroźnymi wyżynami',
    mode: 'new',
  },
  {
    labelKey: 'modal.aiAssistant.templateCanyon',
    promptText: 'Głęboka dolina kanionu przecinająca skaliste wyżyny i szczyty',
    mode: 'new',
  },
  {
    labelKey: 'modal.aiAssistant.templateArena',
    promptText: 'Symetryczna arena 1v1 ze zbalansowanymi zasobami i strategicznym centrum',
    mode: 'new',
  },
  {
    labelKey: 'modal.aiAssistant.templateCaldera',
    promptText: 'Masywny krater wulkaniczny z gorącym kotłem geotermalnym w centrum',
    mode: 'new',
  },
  {
    labelKey: 'modal.aiAssistant.templateOasis',
    promptText: 'Życiodajna oaza nizinna z bogatymi zasobami biomasy i wody',
    mode: 'new',
  },
  {
    labelKey: 'modal.aiAssistant.templateMountains',
    promptText: 'Pasma górskie i wysokie skaliste szczyty',
    mode: 'new',
  },
  {
    labelKey: 'modal.aiAssistant.templatePlains',
    promptText: 'Płaskie równiny pod szybką rozbudowę kolonii',
    mode: 'new',
  },
  {
    labelKey: 'modal.aiAssistant.templateAddIce',
    promptText: 'Dodaj 4 złoża lodu na nizinach',
    mode: 'modify',
  },
  {
    labelKey: 'modal.aiAssistant.templateRaiseWest',
    promptText: 'Podnieś teren na zachodzie i utwórz pasmo wyżyn',
    mode: 'modify',
  },
  {
    labelKey: 'modal.aiAssistant.templateSmoothBase',
    promptText: 'Wygładź klify wokół bazy i wyrównaj teren przy spawnach',
    mode: 'modify',
  },
  {
    labelKey: 'modal.aiAssistant.templateClearDecor',
    promptText: 'Usuń wszystkie dekoracje i skały z mapy',
    mode: 'modify',
  },
]

export const AIAssistantModal = ({ onClose }: AIAssistantModalProps) => {
  const { t } = useTranslation()
  const exportToJSON = useMapEditorStore(s => s.exportToJSON)
  const applyAIMap = useMapEditorStore(s => s.applyAIMap)
  const hexRadius = useMapEditorStore(s => s.hexRadius)
  const hexSeed = useMapEditorStore(s => s.hexSeed)

  const [prompt, setPrompt] = useState<string>('')
  const [mode, setMode] = useState<'new' | 'modify'>('new')
  const [isGenerating, setIsGenerating] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AIMapGenerationResult | null>(null)

  // ── Dismiss on Escape key ───────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // ── Generation handler ──────────────────────────────────────────────────────
  const handleGenerate = useCallback(async (customPrompt?: string) => {
    const activePrompt = (customPrompt ?? prompt).trim()
    if (!activePrompt) {
      setError(t('modal.aiAssistant.promptPlaceholder'))
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      const currentMapData = mode === 'modify' ? exportToJSON() : null
      const genResult = await AIMapGeneratorService.generateFromPrompt(activePrompt, {
        currentMap: currentMapData,
        radius: hexRadius,
        seed: hexSeed,
      })
      setResult(genResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('modal.aiAssistant.errorPrefix'))
    } finally {
      setIsGenerating(false)
    }
  }, [prompt, mode, exportToJSON, hexRadius, hexSeed, t])

  const handleApply = () => {
    if (!result) return
    applyAIMap(result.mapData)
    onClose()
  }

  const handleSelectTemplate = (template: TemplatePrompt) => {
    setMode(template.mode)
    setPrompt(template.promptText)
    handleGenerate(template.promptText)
  }

  // ── Compute Statistics from Preview ─────────────────────────────────────────
  const getTerrainStats = () => {
    if (!result) return null
    const counts: Record<HexTerrainType, number> = {
      deep_crater: 0,
      lowland: 0,
      plains: 0,
      highland: 0,
      rocky: 0,
      peak: 0,
    }
    for (const h of result.mapData.hexes) {
      const tt = h.terrainType as HexTerrainType
      if (counts[tt] !== undefined) counts[tt]++
    }
    return counts
  }

  const getResourceStats = () => {
    if (!result) return null
    const counts: Record<string, number> = { minerals: 0, ice: 0, organics: 0, energy: 0 }
    for (const r of result.mapData.resourceNodes) {
      counts[r.type] = (counts[r.type] || 0) + 1
    }
    return counts
  }

  const terrainStats = getTerrainStats()
  const resourceStats = getResourceStats()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 select-none"
      onClick={onClose}
      data-testid="ai-assistant-backdrop"
    >
      <div
        className="bg-zinc-900 border border-zinc-700/80 rounded-xl p-6 w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] text-zinc-100 font-sans"
        onClick={(e) => e.stopPropagation()}
        data-testid="ai-assistant-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div>
            <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2 tracking-wide uppercase">
              <span className="text-[#e74c3c]">🪐</span> {t('modal.aiAssistant.title')}
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              {t('modal.aiAssistant.subtitle')}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Zamknij"
            className="text-zinc-400 hover:text-zinc-100 transition-colors text-lg p-1 rounded hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto my-4 pr-1 flex flex-col gap-4">
          {/* Mode Selector */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              {t('modal.aiAssistant.modeLabel')}
            </span>
            <div className="flex rounded-lg bg-zinc-950 p-1 border border-zinc-800 text-xs">
              <button
                type="button"
                onClick={() => setMode('new')}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  mode === 'new'
                    ? 'bg-[#c0392b] text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {t('modal.aiAssistant.modeNew')}
              </button>
              <button
                type="button"
                onClick={() => setMode('modify')}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  mode === 'modify'
                    ? 'bg-[#c0392b] text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {t('modal.aiAssistant.modeModify')}
              </button>
            </div>
          </div>

          {/* Prompt Textarea */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ai-map-prompt-input" className="text-xs font-medium text-zinc-300">
              {t('modal.aiAssistant.promptLabel')}
            </label>
            <div className="relative">
              <textarea
                id="ai-map-prompt-input"
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t('modal.aiAssistant.promptPlaceholder')}
                disabled={isGenerating}
                className="w-full bg-zinc-950 border border-zinc-700/80 focus:border-[#e74c3c] rounded-lg p-3 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden transition-colors resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault()
                    handleGenerate()
                  }
                }}
              />
            </div>
          </div>

          {/* Quick Prompts / Templates */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              {t('modal.aiAssistant.quickTemplates')}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATES.filter(tpl => tpl.mode === mode).map((tpl, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelectTemplate(tpl)}
                  disabled={isGenerating}
                  className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-zinc-800/80 hover:bg-zinc-700 hover:text-white border border-zinc-700/60 text-zinc-300 transition-colors disabled:opacity-50"
                >
                  {t(tpl.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-zinc-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              {t('modal.aiAssistant.offlineBadge')}
            </span>

            <button
              type="button"
              onClick={() => handleGenerate()}
              disabled={isGenerating || !prompt.trim()}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#c0392b] hover:bg-[#e74c3c] disabled:opacity-50 text-white transition-all shadow-md flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{t('modal.aiAssistant.generatingBtn')}</span>
                </>
              ) : (
                <>
                  <span>🤖</span>
                  <span>{t('modal.aiAssistant.generateBtn')}</span>
                </>
              )}
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-950/80 border border-red-800 text-red-300 rounded-lg text-xs whitespace-pre-wrap flex items-start gap-2">
              <span>⚠</span>
              <span>{error}</span>
            </div>
          )}

          {/* Generation Result Preview */}
          {result && (
            <div className="flex flex-col gap-3 p-4 bg-zinc-950/70 border border-zinc-800 rounded-xl">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-zinc-100">
                    {t('modal.aiAssistant.summaryTitle')}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-red-950/80 text-red-400 border border-red-900/60 font-mono">
                    {result.mapData.meta.name}
                  </span>
                </div>
                <span className="text-[11px] text-emerald-400 font-mono">✓ {t('modal.aiAssistant.offlineBadge')}</span>
              </div>

              <p className="text-xs text-zinc-300 italic">
                &ldquo;{result.summary}&rdquo;
              </p>

              {/* Applied Operations */}
              {result.operationsApplied.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-zinc-400">
                    {t('modal.aiAssistant.operationsTitle')}
                  </span>
                  <ul className="flex flex-col gap-1 pl-3">
                    {result.operationsApplied.map((op, i) => (
                      <li key={i} className="text-[11px] text-zinc-300 list-disc">
                        {op}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Grid & Entity Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-zinc-800/80">
                <div className="bg-zinc-900/80 p-2 rounded-lg border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 block">{t('modal.aiAssistant.statsTerrain')}</span>
                  <span className="text-xs font-bold text-zinc-200">
                    {result.mapData.hexes.length} heksów
                  </span>
                  <div className="text-[9px] text-zinc-400 mt-1 flex flex-col gap-0.5">
                    <span>Plains: {terrainStats?.plains ?? 0}</span>
                    <span>Lowland: {terrainStats?.lowland ?? 0}</span>
                    <span>Highland: {terrainStats?.highland ?? 0}</span>
                    <span>Peak: {terrainStats?.peak ?? 0}</span>
                  </div>
                </div>

                <div className="bg-zinc-900/80 p-2 rounded-lg border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 block">{t('modal.aiAssistant.statsResources')}</span>
                  <span className="text-xs font-bold text-amber-400">
                    {result.mapData.resourceNodes.length} złóż
                  </span>
                  <div className="text-[9px] text-zinc-400 mt-1 flex flex-col gap-0.5">
                    <span>Lód: {resourceStats?.ice ?? 0}</span>
                    <span>Minerały: {resourceStats?.minerals ?? 0}</span>
                    <span>Energia: {resourceStats?.energy ?? 0}</span>
                    <span>Biomasa: {resourceStats?.organics ?? 0}</span>
                  </div>
                </div>

                <div className="bg-zinc-900/80 p-2 rounded-lg border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 block">{t('modal.aiAssistant.statsSpawns')}</span>
                  <span className="text-xs font-bold text-red-400">
                    {result.mapData.spawnPoints.length} graczy
                  </span>
                  <span className="text-[9px] text-zinc-400 block mt-1">
                    Promień: {result.mapData.meta.hexRadius}
                  </span>
                </div>

                <div className="bg-zinc-900/80 p-2 rounded-lg border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 block">{t('modal.aiAssistant.statsBuildNodes')}</span>
                  <span className="text-xs font-bold text-blue-400">
                    {result.mapData.buildNodes.length} węzłów
                  </span>
                  <span className="text-[9px] text-zinc-400 block mt-1">
                    Dekor: {result.mapData.decor.length}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
          >
            {t('modal.aiAssistant.closeBtn')}
          </button>

          {result && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setResult(null)}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs font-medium transition-colors"
              >
                {t('modal.aiAssistant.discardBtn')}
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
              >
                <span>✓</span>
                <span>{t('modal.aiAssistant.applyBtn')}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
