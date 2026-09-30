/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Test regresji `render.yaml` (Render Blueprint) i startu obrazu API (Faza 8, D15).
 *
 * W zależnościach bezpośrednich nie ma parsera YAML, a RULES zabrania dodawania paczek bez zgody.
 * Dlatego test używa minimalnego, świadomie ograniczonego czytnika:
 * - linie komentarzy (`# ...`) i puste są pomijane, więc zakomentowane klucze NIE liczą się jako ustawione;
 * - pola usługi to linie `klucz: wartość` na wcięciu 4 spacji (jedna usługa w `services`);
 * - `envVars` to pary `- key: X` + następna linia `value: ...` albo `sync: false`.
 * Obsługiwany jest tylko podzbiór YAML używany w `render.yaml`.
 */
const raw = readFileSync(resolve(process.cwd(), 'render.yaml'), 'utf-8')
const dockerfile = readFileSync(resolve(process.cwd(), 'Dockerfile.api'), 'utf-8')

const lines = raw
  .split(/\r?\n/)
  .filter((line) => line.trim() !== '' && !line.trim().startsWith('#'))

const unquote = (value: string): string => value.trim().replace(/^"(.*)"$/, '$1')

const serviceFields = new Map<string, string>()
for (const line of lines) {
  const match = /^ {4}([A-Za-z]+):\s*(.*)$/.exec(line)
  if (match) serviceFields.set(match[1], unquote(match[2]))
}
const firstServiceLine = lines.find((line) => /^ {2}- /.test(line)) ?? ''
const firstService = /^ {2}- ([A-Za-z]+):\s*(.*)$/.exec(firstServiceLine)
if (firstService) serviceFields.set(firstService[1], unquote(firstService[2]))

interface EnvVar {
  value?: string
  sync?: string
}
const envVars = new Map<string, EnvVar>()
lines.forEach((line, index) => {
  const key = /^ {6}- key:\s*(\S+)$/.exec(line)
  if (!key) return
  const next = /^ {8}(value|sync):\s*(.*)$/.exec(lines[index + 1] ?? '')
  const entry: EnvVar = {}
  if (next?.[1] === 'value') entry.value = unquote(next[2])
  if (next?.[1] === 'sync') entry.sync = next[2].trim()
  envVars.set(key[1], entry)
})

const SECRET_KEYS = [
  'jwt_secret',
  'account_secret',
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

describe('render.yaml (API na Render)', () => {
  it('definiuje jedną usługę web z Dockerfile.api na darmowym planie we Frankfurcie', () => {
    expect(lines.filter((line) => /^ {2}- /.test(line))).toHaveLength(1)
    expect(serviceFields.get('type')).toBe('web')
    expect(serviceFields.get('name')).toBe('mars-terraform-api')
    expect(serviceFields.get('runtime')).toBe('docker')
    expect(serviceFields.get('plan')).toBe('free')
    expect(serviceFields.get('region')).toBe('frankfurt')
    expect(serviceFields.get('dockerfilePath')).toBe('./Dockerfile.api')
    expect(serviceFields.get('dockerContext')).toBe('.')
  })

  it('wdraża main dopiero po zielonym CI i sprawdza /api/health', () => {
    expect(serviceFields.get('branch')).toBe('main')
    expect(serviceFields.get('autoDeployTrigger')).toBe('checksPass')
    expect(serviceFields.get('healthCheckPath')).toBe('/api/health')
  })

  it('nie używa preDeployCommand ani dockerCommand (migracje są w CMD obrazu)', () => {
    expect(serviceFields.has('preDeployCommand')).toBe(false)
    expect(serviceFields.has('dockerCommand')).toBe(false)
  })

  it('ustawia jawne wartości niesekretne w trybie API-only', () => {
    expect(envVars.get('NODE_ENV')).toEqual({ value: 'production' })
    expect(envVars.get('serve_frontend')).toEqual({ value: 'false' })
    expect(envVars.get('PORT')).toEqual({ value: '8080' })
    expect(envVars.has('backend_url')).toBe(false)
  })

  it('wymagane sekrety są zadeklarowane wyłącznie jako sync: false (bez wartości)', () => {
    for (const key of ['jwt_secret', 'account_secret', 'turso_url', 'turso_token']) {
      expect(envVars.get(key), key).toEqual({ sync: 'false' })
    }
    for (const key of SECRET_KEYS) {
      const entry = envVars.get(key)
      if (entry) expect(entry.value, `sekret "${key}" z wartością`).toBeUndefined()
    }
  })

  it('nie deklaruje frontend_url / cors_origins (T13: frontend_url zbędny, CORS po poznaniu domeny Vercel)', () => {
    expect(envVars.has('frontend_url')).toBe(false)
    expect(envVars.has('cors_origins')).toBe(false)
  })

  it('nie zawiera sekretów w całym pliku (także w komentarzach)', () => {
    expect(raw).not.toMatch(/libsql:\/\/[a-z0-9]/i)
    expect(raw).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/)
  })

  it('wymienia w komentarzu nazwy opcjonalnych zmiennych', () => {
    for (const key of ['account_secret', 'cors_origins', 'openrouter_api_key']) {
      expect(raw).toContain(key)
    }
  })
})

describe('Dockerfile.api (start = migracje, potem API)', () => {
  it('CMD uruchamia migrate.js, a API tylko po sukcesie, przez exec pod tini', () => {
    expect(dockerfile).toContain('ENTRYPOINT ["/sbin/tini", "--"]')
    expect(dockerfile).toContain(
      'CMD ["sh", "-c", "node dist_backend/migrate.js && exec node dist_backend/index.js"]',
    )
  })

  it('port z EXPOSE zgadza się z PORT w render.yaml', () => {
    expect(dockerfile).toMatch(/^EXPOSE 8080$/m)
    expect(dockerfile).toMatch(/PORT=8080/)
  })
})
