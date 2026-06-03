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

  // ── Errors (block export) ──────────────────────────────────────────────────

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

  const [sizeX, sizeZ] = data.meta.size
  for (const node of data.buildNodes) {
    if (node.pos[0] < 0 || node.pos[0] >= sizeX || node.pos[1] < 0 || node.pos[1] >= sizeZ) {
      errors.push({ level: 'error', message: `Build node "${node.id}" is out of map bounds.` })
    }
  }
  for (const node of data.resourceNodes) {
    if (node.pos[0] < 0 || node.pos[0] >= sizeX || node.pos[1] < 0 || node.pos[1] >= sizeZ) {
      errors.push({ level: 'error', message: `Resource node "${node.id}" is out of map bounds.` })
    }
  }

  // ── Warnings (allow export) ────────────────────────────────────────────────

  if (data.buildNodes.length === 0) {
    errors.push({ level: 'warning', message: 'No build nodes — players cannot build.' })
  }
  if (data.resourceNodes.length === 0) {
    errors.push({ level: 'warning', message: 'No resource nodes — no economy.' })
  }
  if (data.spawnPoints.length === 0) {
    errors.push({ level: 'warning', message: 'No spawn points placed.' })
  }

  // Spawn on blocked tile check
  try {
    const raw = atob(data.blockedTiles)
    const tiles = new Uint8Array(raw.length)
    for (let i = 0; i < raw.length; i++) tiles[i] = raw.charCodeAt(i)
    for (const spawn of data.spawnPoints) {
      const idx = spawn.pos[1] * sizeX + spawn.pos[0]
      if (tiles[idx] === 3) {
        errors.push({ level: 'warning', message: `Spawn P${spawn.player} is on a blocked tile.` })
      }
    }
  } catch { /* ignore */ }

  return { valid: !errors.some(e => e.level === 'error'), errors }
}
