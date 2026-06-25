import { useEffect } from 'react'
import GeneratorToolbar from './components/GeneratorToolbar'
import GeneratorLeftPanel from './components/GeneratorLeftPanel'
import GeneratorRightPanel from './components/GeneratorRightPanel'
import GeneratorViewport from './components/GeneratorViewport'
import { useMapEditorStore } from '../../application/store/useMapEditorStore'
import type { ToolMode, BrushSize } from '../../domain/mapEditorTypes'

const GeneratorPage = () => {
  const setActiveTool = useMapEditorStore(s => s.setActiveTool)
  const setBrushSize = useMapEditorStore(s => s.setBrushSize)
  const toggleGrid = useMapEditorStore(s => s.toggleGrid)
  const undo = useMapEditorStore(s => s.undo)

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      const toolMap: Record<string, ToolMode> = {
        v: 'select', t: 'terrain', b: 'build', r: 'resource', x: 'blocked', s: 'spawn', e: 'erase', d: 'decor',
      }
      const brushMap: Record<string, BrushSize> = { '1': 1, '2': 3, '3': 5 }

      if (toolMap[e.key.toLowerCase()]) {
        setActiveTool(toolMap[e.key.toLowerCase()])
        return
      }
      if (brushMap[e.key]) {
        setBrushSize(brushMap[e.key])
        return
      }
      if (e.key.toLowerCase() === 'g') {
        toggleGrid()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        undo()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setActiveTool, setBrushSize, toggleGrid, undo])

  return (
    <div className="flex flex-col w-full h-screen bg-zinc-900 overflow-hidden">
      {/* Toolbar */}
      <GeneratorToolbar />

      {/* Main layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left panel */}
        <div className="w-44 shrink-0">
          <GeneratorLeftPanel />
        </div>

        {/* Viewport */}
        <div className="flex-1 min-w-0">
          <GeneratorViewport />
        </div>

        {/* Right panel */}
        <div className="w-64 shrink-0">
          <GeneratorRightPanel />
        </div>
      </div>
    </div>
  )
}

export default GeneratorPage
