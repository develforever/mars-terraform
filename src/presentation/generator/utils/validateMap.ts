import type { MapExportJSON } from '../../../domain/mapEditorTypes'
import { hexDistance } from '../hex/HexMath'

export interface ValidationError {
  level: 'error' | 'warning'
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

/** Minimalny dystans (w heksach) miedzy spawnami zanim ostrzezemy o nierownosci. */
const MIN_SPAWN_DISTANCE = 4

export const validateMap = (data: MapExportJSON): ValidationResult => {
  const errors: ValidationError[] = []
  const err  = (message: string) => errors.push({ level: 'error', message })
  const warn = (message: string) => errors.push({ level: 'warning', message })

  // ── Errors (meta / spawny) ──────────────────────────────────────────────
  if (!data.meta.name.trim()) err('Map name is empty.')
  if (data.meta.players < 1 || data.meta.players > 4) err('Players must be between 1 and 4.')

  if (data.spawnPoints.length < data.meta.players) {
    err(`Missing spawn points: need ${data.meta.players}, have ${data.spawnPoints.length}.`)
  }
  const playerNums = data.spawnPoints.map(s => s.player)
  if (new Set(playerNums).size !== playerNums.length) {
    err('Duplicate spawn points for same player.')
  }

  // ── Granice mapy + zablokowane heksy (tylko gdy mamy hexes) ──────────────
  if (data.hexes.length > 0) {
    const inMap   = new Set(data.hexes.map(h => `${h.q},${h.r}`))
    const checkPos = (kind: string, pos: [number, number]) => {
      if (!inMap.has(`${pos[0]},${pos[1]}`)) {
        err(`${kind} at (${pos[0]}, ${pos[1]}) is outside the map.`)
      }
    }
    for (const s of data.spawnPoints) {
      checkPos(`Spawn P${s.player}`, s.pos)
    }
    for (const b of data.buildNodes)    checkPos('Build node', b.pos)
    for (const r of data.resourceNodes) checkPos('Resource node', r.pos)
  }

  // ── Rownosc startowa: spawny zbyt blisko siebie ──────────────────────────
  for (let i = 0; i < data.spawnPoints.length; i++) {
    for (let j = i + 1; j < data.spawnPoints.length; j++) {
      const a = data.spawnPoints[i].pos, b = data.spawnPoints[j].pos
      const d = hexDistance(a[0], a[1], b[0], b[1])
      if (d < MIN_SPAWN_DISTANCE) {
        warn(`Spawns ${data.spawnPoints[i].player} and ${data.spawnPoints[j].player} are very close (distance ${d}).`)
      }
    }
  }

  // ── Warnings ──────────────────────────────────────────────────────────────
  if (data.buildNodes.length === 0)    warn('No build nodes — players cannot build.')
  if (data.resourceNodes.length === 0) warn('No resource nodes — no economy.')
  if (data.spawnPoints.length === 0)   warn('No spawn points placed.')
  if (data.resourceNodes.length > 0 && data.resourceNodes.length < data.meta.players) {
    warn(`Few resource nodes (${data.resourceNodes.length}) for ${data.meta.players} players.`)
  }

  return { valid: !errors.some(e => e.level === 'error'), errors }
}
