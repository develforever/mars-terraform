import { useState, useEffect } from 'react'
import { useMapEditorStore } from '../../../application/store/useMapEditorStore'
import { validateMap } from '../utils/validateMap'
import type { ValidationResult } from '../utils/validateMap'
import { parseMapJSON } from '../schema/mapSchema'
import { authClient } from '../../../application/service/authService'
import { mapApiService } from '../../../application/service/mapApiService'
import { CloudMapsModal } from './CloudMapsModal'
import { AIAssistantModal } from './AIAssistantModal'

// ─── Validation modal ─────────────────────────────────────────────────────────

const ValidationModal = ({
  result,
  onConfirm,
  onCancel,
}: {
  result: ValidationResult
  onConfirm: () => void
  onCancel: () => void
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 select-none"
      onClick={onCancel}
    >
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-lg p-5 w-96 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-zinc-100">
            {result.valid ? '⚠️ Map Warnings' : '🚫 Map Errors'}
          </h2>
          <button
            onClick={onCancel}
            aria-label="Zamknij"
            className="text-zinc-400 hover:text-zinc-100 text-sm p-1 rounded hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>

        <ul className="flex flex-col gap-1.5 mb-4 max-h-60 overflow-y-auto">
          {result.errors.map((e, i) => (
            <li key={i} className={`text-xs flex gap-2 items-start ${
              e.level === 'error' ? 'text-red-400' : 'text-yellow-400'
            }`}>
              <span>{e.level === 'error' ? '✖' : '⚠'}</span>
              <span>{e.message}</span>
            </li>
          ))}
        </ul>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition-colors"
          >
            Cancel
          </button>
          {result.valid && (
            <button
              onClick={onConfirm}
              className="px-3 py-1.5 rounded bg-[#c0392b] hover:bg-[#e74c3c] text-white text-xs font-medium transition-colors"
            >
              Export Anyway
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Toolbar ──────────────────────────────────────────────────────────────────

const GeneratorToolbar = () => {
  const toggleGrid    = useMapEditorStore(s => s.toggleGrid)
  const showGrid      = useMapEditorStore(s => s.showGrid)
  const togglePreview = useMapEditorStore(s => s.togglePreview)
  const isPreviewMode = useMapEditorStore(s => s.isPreviewMode)
  const resetMap      = useMapEditorStore(s => s.resetMap)
  const exportToJSON = useMapEditorStore(s => s.exportToJSON)
  const loadFromJSON = useMapEditorStore(s => s.loadFromJSON)
  const meta = useMapEditorStore(s => s.meta)
  const undo = useMapEditorStore(s => s.undo)
  const generateHexGrid = useMapEditorStore(s => s.generateHexGrid)
  const hexRadius = useMapEditorStore(s => s.hexRadius)
  const hexSeed = useMapEditorStore(s => s.hexSeed)

  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [pendingExportData, setPendingExportData] = useState<string | null>(null)
  const [isCloudModalOpen, setIsCloudModalOpen] = useState<boolean>(false)
  const [isAIModalOpen, setIsAIModalOpen] = useState<boolean>(false)
  const [isSavingCloud, setIsSavingCloud] = useState<boolean>(false)
  const [cloudSaveStatus, setCloudSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const doDownload = (json: string, name: string) => {
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name || 'map'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExport = () => {
    const data = exportToJSON()
    const result = validateMap(data)
    const json = JSON.stringify(data, null, 2)

    if (result.errors.length === 0) {
      // No issues — export immediately
      doDownload(json, meta.name)
    } else {
      // Show modal
      setPendingExportData(json)
      setValidationResult(result)
    }
  }

  const handleSaveCloud = async () => {
    if (!authClient.isAuthenticated()) {
      alert('Musisz być zalogowany, aby zapisać mapę w chmurze.')
      return
    }

    const data = exportToJSON()
    const result = validateMap(data)
    const hasErrors = result.errors.some(e => e.level === 'error')

    if (hasErrors) {
      if (!window.confirm('Mapa zawiera błędy walidacji. Czy na pewno chcesz ją zapisać w chmurze?')) {
        return
      }
    }

    setIsSavingCloud(true)
    setCloudSaveStatus(null)

    try {
      const saved = await mapApiService.saveMap(data)
      setCloudSaveStatus({
        type: 'success',
        message: `Mapa "${saved.name}" została zapisana w chmurze!`,
      })
      setTimeout(() => setCloudSaveStatus(null), 4000)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Błąd podczas zapisu mapy'
      setCloudSaveStatus({
        type: 'error',
        message: errorMsg,
      })
      setTimeout(() => setCloudSaveStatus(null), 5000)
    } finally {
      setIsSavingCloud(false)
    }
  }

  const handleValidationConfirm = () => {
    if (pendingExportData) doDownload(pendingExportData, meta.name)
    setValidationResult(null)
    setPendingExportData(null)
  }

  const handleValidationCancel = () => {
    setValidationResult(null)
    setPendingExportData(null)
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const data = JSON.parse(text)
        const parsed = parseMapJSON(data)
        if (!parsed.ok) {
          alert('Nieprawidlowy plik mapy:\n' + parsed.error)
          return
        }
        loadFromJSON(parsed.data)
      } catch {
        alert('Nie udalo sie odczytac pliku JSON.')
      }
    }
    input.click()
  }

  const handleReset = () => {
    if (window.confirm('Reset the entire map? This cannot be undone.')) resetMap()
  }

  // Live validation badge
  const liveResult = validateMap(exportToJSON())
  const errorCount = liveResult.errors.filter(e => e.level === 'error').length
  const warnCount = liveResult.errors.filter(e => e.level === 'warning').length

  return (
    <>
      {validationResult && (
        <ValidationModal
          result={validationResult}
          onConfirm={handleValidationConfirm}
          onCancel={handleValidationCancel}
        />
      )}

      {cloudSaveStatus && (
        <div className={`fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded-lg shadow-xl text-xs font-medium border flex items-center gap-2 ${
          cloudSaveStatus.type === 'success'
            ? 'bg-emerald-950 border-emerald-700 text-emerald-200'
            : 'bg-red-950 border-red-800 text-red-200'
        }`}>
          <span>{cloudSaveStatus.type === 'success' ? '✓' : '⚠'}</span>
          <span>{cloudSaveStatus.message}</span>
        </div>
      )}

      {isCloudModalOpen && (
        <CloudMapsModal onClose={() => setIsCloudModalOpen(false)} />
      )}

      {isAIModalOpen && (
        <AIAssistantModal onClose={() => setIsAIModalOpen(false)} />
      )}

      <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-950 border-b border-zinc-700 text-sm select-none">
        <span className="text-[#e74c3c] font-bold tracking-wider text-xs uppercase mr-2">
          🪐 Map Generator
        </span>

        <div className="w-px h-4 bg-zinc-700" />

        <button onClick={handleReset}
          className="px-2 py-1 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors text-xs">
          🗺 New
        </button>

        <button
          onClick={() => {
            const s = Math.floor(Math.random() * 99999)
            generateHexGrid(hexRadius, s)
          }}
          className="px-2 py-1 rounded bg-[#c0392b] hover:bg-[#e74c3c] text-white transition-colors text-xs font-medium flex items-center gap-1"
          title={`Wygeneruj nową deterministyczną mapę (akt. seed: ${hexSeed})`}
        >
          🎲 Generate Map
        </button>

        <button
          onClick={() => setIsAIModalOpen(true)}
          className="px-2.5 py-1 rounded bg-linear-to-r from-purple-700 to-[#c0392b] hover:from-purple-600 hover:to-[#e74c3c] text-white transition-all text-xs font-semibold flex items-center gap-1 shadow-xs"
          title="Otwórz asystenta AI generowania i modyfikacji mapy"
        >
          🤖 AI Assistant
        </button>

        <button onClick={handleImport}
          className="px-2 py-1 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors text-xs">
          📂 Load
        </button>

        <button
          onClick={handleExport}
          className={`px-2 py-1 rounded text-white transition-colors text-xs font-medium relative
            ${errorCount > 0 ? 'bg-red-800 hover:bg-red-700' : 'bg-[#c0392b] hover:bg-[#e74c3c]'}`}
        >
          💾 Export JSON
          {errorCount > 0 && (
            <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1">{errorCount}</span>
          )}
          {errorCount === 0 && warnCount > 0 && (
            <span className="ml-1.5 bg-yellow-500 text-black text-xs rounded-full px-1">{warnCount}</span>
          )}
        </button>

        <div className="w-px h-4 bg-zinc-700" />

        <button
          onClick={handleSaveCloud}
          disabled={isSavingCloud}
          className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 hover:text-white transition-colors text-xs flex items-center gap-1 font-medium"
          title="Zapisz mapę do chmury Mars"
        >
          ☁ {isSavingCloud ? 'Saving...' : 'Save Cloud'}
        </button>

        <button
          onClick={() => setIsCloudModalOpen(true)}
          className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white transition-colors text-xs flex items-center gap-1 font-medium"
          title="Otwórz przeglądarkę map w chmurze"
        >
          ☁ Cloud
        </button>

        <div className="w-px h-4 bg-zinc-700" />

        <button onClick={undo}
          className="px-2 py-1 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors text-xs"
          title="Ctrl+Z">
          ↩ Undo
        </button>

        <button onClick={toggleGrid}
          className={`px-2 py-1 rounded text-xs transition-colors ${
            showGrid ? 'bg-zinc-700 text-[#ec7063]' : 'hover:bg-zinc-800 text-zinc-500'}`}>
          ⊞ Grid
        </button>

        <button onClick={togglePreview}
          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
            isPreviewMode
              ? 'bg-[#c0392b] text-white'
              : 'hover:bg-zinc-800 text-zinc-400'}`}
          title="Podgląd płynnego terenu gry">
          ◈ Preview
        </button>

        <div className="flex-1" />

        {/* Live validation status */}
        {liveResult.errors.length > 0 ? (
          <div className="flex items-center gap-1">
            {errorCount > 0 && (
              <span className="text-xs text-red-400 font-mono">✖ {errorCount} error{errorCount > 1 ? 's' : ''}</span>
            )}
            {warnCount > 0 && (
              <span className="text-xs text-yellow-400 font-mono">⚠ {warnCount} warn{warnCount > 1 ? 's' : ''}</span>
            )}
          </div>
        ) : (
          <span className="text-xs text-green-500 font-mono">✓ Valid</span>
        )}

        <div className="w-px h-4 bg-zinc-700 mx-1" />

        <span className="text-xs text-zinc-500 font-mono">
          {meta.name}
        </span>
      </div>
    </>
  )
}

export default GeneratorToolbar

