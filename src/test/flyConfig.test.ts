/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Test regresji `fly.toml` (Faza 8, T6).
 *
 * W zależnościach nie ma parsera TOML (ani bezpośrednio, ani przechodnio), a RULES zabrania
 * dodawania paczek bez zgody. Dlatego test używa minimalnego, świadomie ograniczonego czytnika:
 * - linie komentarzy (`# ...`) i puste są pomijane, więc zakomentowane klucze NIE liczą się jako ustawione;
 * - plik jest dzielony na sekcje po nagłówkach `[tabela]` / `[[tablica.tabel]]`;
 *   klucze przed pierwszym nagłówkiem należą do sekcji `''` (poziom główny);
 * - wartości są porównywane jako surowy tekst po `=` (np. `"fra"`, `8080`, `true`).
 * Obsługiwany jest tylko podzbiór TOML używany w `fly.toml` (bez wartości wielolinijkowych).
 */
const raw = readFileSync(resolve(process.cwd(), 'fly.toml'), 'utf-8')

const HEADER = /^\[\[?\s*([A-Za-z0-9_.]+)\s*\]\]?$/
const KEY_VALUE = /^([A-Za-z0-9_]+)\s*=\s*(.+)$/

const parseSections = (text: string): Map<string, Map<string, string>> => {
  const sections = new Map<string, Map<string, string>>([['', new Map()]])
  let current = sections.get('') as Map<string, string>
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) continue
    const header = HEADER.exec(trimmed)
    if (header) {
      const name = header[1]
      const existing = sections.get(name)
      current = existing ?? new Map<string, string>()
      if (!existing) sections.set(name, current)
      continue
    }
    const kv = KEY_VALUE.exec(trimmed)
    if (kv) current.set(kv[1], kv[2].trim())
  }
  return sections
}

const sections = parseSections(raw)

const section = (name: string): Map<string, string> => {
  const found = sections.get(name)
  if (!found) throw new Error(`fly.toml: brak sekcji [${name}]`)
  return found
}

describe('fly.toml (API na Fly.io)', () => {
  it('ma nazwę aplikacji, region i sygnał zatrzymania', () => {
    const root = section('')
    expect(root.get('app')).toBe('"mars-terraform-api"')
    expect(root.get('primary_region')).toMatch(/^"[a-z]{3}"$/)
    expect(root.get('kill_signal')).toBe('"SIGTERM"')
    expect(root.get('kill_timeout')).toBe('"10s"')
  })

  it('buduje z Dockerfile.api z jego własnym allowlistem kontekstu', () => {
    const build = section('build')
    expect(build.get('dockerfile')).toBe('"Dockerfile.api"')
    expect(build.get('ignorefile')).toBe('"Dockerfile.api.dockerignore"')
  })

  it('[env] zawiera tylko wartości niesekretne w trybie API-only', () => {
    const env = section('env')
    expect(env.get('NODE_ENV')).toBe('"production"')
    expect(env.get('serve_frontend')).toBe('"false"')
    expect(env.get('PORT')).toBe('"8080"')
    expect(env.get('backend_url')).toBe('"https://mars-terraform-api.fly.dev"')
  })

  it('[env] nie ustawia pustych frontend_url / cors_origins (do czasu poznania domeny Vercel)', () => {
    const env = section('env')
    expect(env.has('frontend_url')).toBe(false)
    expect(env.has('cors_origins')).toBe(false)
    for (const value of env.values()) {
      expect(value).not.toBe('""')
    }
  })

  it('nie zawiera sekretów jako kluczy ani wartości', () => {
    const secretKeys = [
      'jwt_secret',
      'turso_url',
      'turso_token',
      'google_client_secret',
      'github_client_secret',
      'smtp_pass',
      'sendgrid_api_key',
      'mailgun_api_key',
      'resend_api_key',
      'mailjet_api_secret',
      'mailtrap_api_token',
      'openrouter_api_key',
    ]
    for (const [name, entries] of sections) {
      for (const key of secretKeys) {
        expect(entries.has(key), `sekret "${key}" w sekcji [${name}]`).toBe(false)
      }
    }
    // Żadnych adresów libsql ani wartości wyglądających na tokeny w całym pliku (także w komentarzach).
    expect(raw).not.toMatch(/libsql:\/\/[a-z0-9]/i)
    expect(raw).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/)
  })

  it('wymienia w komentarzu nazwy wymaganych sekretów', () => {
    for (const key of ['jwt_secret', 'turso_url', 'turso_token', 'openrouter_api_key']) {
      expect(raw).toContain(key)
    }
    expect(raw).toMatch(/fly secrets set/)
  })

  it('[http_service] kieruje ruch na port 8080 z HTTPS i auto stop/start', () => {
    const http = section('http_service')
    expect(http.get('internal_port')).toBe('8080')
    expect(http.get('force_https')).toBe('true')
    expect(http.get('auto_stop_machines')).toBe('"stop"')
    expect(http.get('auto_start_machines')).toBe('true')
    expect(http.get('min_machines_running')).toBe('0')
  })

  it('[http_service.concurrency] limituje żądania (soft < hard)', () => {
    const concurrency = section('http_service.concurrency')
    expect(concurrency.get('type')).toBe('"requests"')
    const soft = Number(concurrency.get('soft_limit'))
    const hard = Number(concurrency.get('hard_limit'))
    expect(Number.isInteger(soft) && soft > 0).toBe(true)
    expect(hard).toBeGreaterThan(soft)
  })

  it('health check odpytuje GET /api/health z timeoutem dłuższym niż timeout DB (2 s)', () => {
    const checks = section('http_service.checks')
    expect(checks.get('method')).toBe('"GET"')
    expect(checks.get('path')).toBe('"/api/health"')
    expect(checks.get('interval')).toBe('"15s"')
    expect(checks.get('timeout')).toBe('"5s"')
    expect(checks.get('grace_period')).toBe('"10s"')
  })

  it('[deploy] używa rolling i uruchamia migracje (T7) jako release_command', () => {
    const deploy = section('deploy')
    expect(deploy.get('strategy')).toBe('"rolling"')
    expect(deploy.get('release_command')).toBe('"node dist_backend/migrate.js"')
  })

  it('[[vm]] to shared-cpu-1x z 512 MB', () => {
    const vm = section('vm')
    expect(vm.get('size')).toBe('"shared-cpu-1x"')
    expect(vm.get('memory')).toBe('"512mb"')
  })

  it('nie montuje wolumenu (D2 = Turso, kontener bezstanowy)', () => {
    expect(sections.has('mounts')).toBe(false)
  })
})
