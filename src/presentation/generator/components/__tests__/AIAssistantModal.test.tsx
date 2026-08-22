import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AIAssistantModal } from '../AIAssistantModal'
import { useMapEditorStore } from '../../../../application/store/useMapEditorStore'

describe('AIAssistantModal', () => {
  const handleClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    useMapEditorStore.getState().resetMap()
  })

  it('renders modal header, prompt textarea, templates, and buttons', () => {
    render(<AIAssistantModal onClose={handleClose} />)

    expect(screen.getByText('modal.aiAssistant.title')).toBeInTheDocument()
    expect(screen.getByLabelText('modal.aiAssistant.promptLabel')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /modal.aiAssistant.generateBtn/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /modal.aiAssistant.closeBtn/i })).toBeInTheDocument()
  })

  it('calls onClose when close button ✕ is clicked', () => {
    render(<AIAssistantModal onClose={handleClose} />)

    const closeBtn = screen.getByRole('button', { name: 'Zamknij' })
    fireEvent.click(closeBtn)

    expect(handleClose).toHaveBeenCalled()
  })

  it('calls onClose when backdrop is clicked, but not when modal card is clicked', () => {
    render(<AIAssistantModal onClose={handleClose} />)

    const modalBackdrop = screen.getByTestId('ai-assistant-backdrop')
    const modalCard = screen.getByTestId('ai-assistant-modal')

    // Clicking inside modal card should NOT close
    fireEvent.click(modalCard)
    expect(handleClose).not.toHaveBeenCalled()

    // Clicking backdrop SHOULD close
    fireEvent.click(modalBackdrop)
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Escape key is pressed', () => {
    render(<AIAssistantModal onClose={handleClose} />)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('switches between New and Modify modes', () => {
    render(<AIAssistantModal onClose={handleClose} />)

    const modifyModeBtn = screen.getByRole('button', { name: 'modal.aiAssistant.modeModify' })
    fireEvent.click(modifyModeBtn)

    // Should show modify template chips
    expect(screen.getByRole('button', { name: 'modal.aiAssistant.templateAddIce' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'modal.aiAssistant.templateSmoothBase' })).toBeInTheDocument()
  })

  it('generates map on template click and applies it to map editor store', async () => {
    const applyAIMapSpy = vi.spyOn(useMapEditorStore.getState(), 'applyAIMap')
    render(<AIAssistantModal onClose={handleClose} />)

    // Click Ice Crater template
    const iceTemplateBtn = screen.getByRole('button', { name: 'modal.aiAssistant.templateIceCrater' })
    fireEvent.click(iceTemplateBtn)

    // Wait for generation result
    await waitFor(() => {
      expect(screen.getByText('modal.aiAssistant.summaryTitle')).toBeInTheDocument()
    })

    expect(screen.getByText('modal.aiAssistant.operationsTitle')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /modal.aiAssistant.applyBtn/i })).toBeInTheDocument()

    // Click Apply
    const applyBtn = screen.getByRole('button', { name: /modal.aiAssistant.applyBtn/i })
    fireEvent.click(applyBtn)

    expect(applyAIMapSpy).toHaveBeenCalled()
    expect(handleClose).toHaveBeenCalled()
  })
})
