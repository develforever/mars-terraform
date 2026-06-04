import type { MapExportJSON } from '../../../domain/mapEditorTypes'

export interface ValidationError {
  level: 'error' | 'warning'
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

export const validateMap = (data: MapExportJSON): ValidationResult => {
  const errors: ValidationError[] = []

  // ── Errors ────────────────────────────────────────────────────────────────

  if (!data.meta.name.trim()) {
    errors.push({ level: 'error', message: 'Map name is empty.' })
  }

  if (data.meta.players < 1 || data.meta.players > 4) {
    errors.push({ level: 'error', message: 'Players must be between 1 and 4.' })
  }

  if (data.spawnPoints.length < data.meta.players) {
    errors.push({
      level: 'error',
      message: `Missing spawn points: need ${data.meta.players}, have ${data.spawnPoints.length}.`,
    })
  }

  const playerNums = data.spawnPoints.map(s => s.player)
  if (new Set(playerNums).size !== playerNums.length) {
    errors.push({ level: 'error', message: 'Duplicate spawn points for same player.' })
  }

  // ── Warnings ──────────────────────────────────────────────────────────────

  if (data.buildNodes.length === 0) {
    errors.push({ level: 'warning', message: 'No build nodes — players cannot build.' })
  }
  if (data.resourceNodes.length === 0) {
    errors.push({ level: 'warning', message: 'No resource nodes — no economy.' })
  }
  if (data.spawnPoints.length === 0) {
    errors.push({ level: 'warning', message: 'No spawn points placed.' })
  }

  return { valid: !errors.some(e => e.level === 'error'), errors }
}
