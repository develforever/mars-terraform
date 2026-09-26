/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

interface VercelHeader {
  key: string
  value: string
}

interface VercelHeaderRule {
  source: string
  headers: VercelHeader[]
}

interface VercelRewrite {
  source: string
  destination: string
}

interface VercelConfig {
  $schema: string
  framework: string
  installCommand: string
  buildCommand: string
  outputDirectory: string
  rewrites: VercelRewrite[]
  headers: VercelHeaderRule[]
}

const config = JSON.parse(
  readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf-8'),
) as VercelConfig

/**
 * Kompiluje `source` Vercela (składnia path-to-regexp) do RegExp.
 * Reguły w vercel.json używają wyłącznie grup regex i alternatyw, więc
 * wystarczy zakotwiczyć wzorzec.
 */
const sourceToRegExp = (source: string): RegExp => new RegExp(`^${source}$`)

const matches = (source: string, path: string): boolean => sourceToRegExp(source).test(path)

/**
 * Efektywne nagłówki dla ścieżki wg semantyki Vercela: stosowane są wszystkie
 * pasujące reguły w kolejności z pliku, a późniejsza nadpisuje ten sam klucz.
 * Dopasowanie odbywa się po ścieżce żądania (przed rewrite).
 */
const effectiveHeaders = (path: string): Map<string, string> => {
  const result = new Map<string, string>()
  config.headers
    .filter((rule) => matches(rule.source, path))
    .forEach((rule) => {
      rule.headers.forEach((header) => {
        result.set(header.key.toLowerCase(), header.value)
      })
    })
  return result
}

const cacheControlFor = (path: string): string | undefined => effectiveHeaders(path).get('cache-control')

describe('vercel.json', () => {
  it('uses the Vercel schema and the Vite framework preset', () => {
    expect(config.$schema).toBe('https://openapi.vercel.sh/vercel.json')
    expect(config.framework).toBe('vite')
    expect(config.installCommand).toBe('npm ci')
  })

  it('builds only the frontend into dist', () => {
    expect(config.buildCommand).toBe('tsc -b && vite build')
    expect(config.buildCommand).not.toMatch(/build:back|vite\.config\.backend|npm run build/)
    expect(config.outputDirectory).toBe('dist')
  })

  it('has an SPA fallback rewrite to index.html', () => {
    const fallback = config.rewrites.find((rewrite) => rewrite.destination === '/index.html')
    expect(fallback).toBeDefined()
    expect(fallback?.source).toBe('/(.*)')
    ;['/', '/generate', '/mars', '/some/deep/route'].forEach((path) => {
      expect(matches(fallback?.source ?? '', path)).toBe(true)
    })
  })

  it('does not proxy /api through Vercel (D3: direct VITE_API_URL + CORS)', () => {
    config.rewrites.forEach((rewrite) => {
      expect(rewrite.source.startsWith('/api')).toBe(false)
      expect(rewrite.destination).not.toMatch(/^https?:\/\//)
      expect(rewrite.destination).not.toContain('/api')
    })
  })

  it('caches Vite hashed bundles as immutable for one year', () => {
    ;['/assets/index-abc123.js', '/assets/vendor-three-Dx9.js', '/assets/index-f00.css'].forEach((path) => {
      expect(cacheControlFor(path)).toBe('public, max-age=31536000, immutable')
    })
  })

  it('caches unhashed models, textures and icons with SWR and never immutable', () => {
    const swrRule = config.headers.find((rule) => rule.source === '/(models|textures|icons)/(.*)')
    expect(swrRule).toBeDefined()
    ;[
      '/textures/2k_mars.jpg',
      '/models/mars_terrain.glb',
      '/models/mars/buildings/rover.glb',
      '/icons/buildings/habitat.webp',
    ].forEach((path) => {
      const value = cacheControlFor(path)
      expect(value).toBe('public, max-age=86400, stale-while-revalidate=604800')
      expect(value).not.toContain('immutable')
    })
  })

  it('serves index.html and SPA routes with no-cache', () => {
    ;['/', '/index.html', '/generate', '/mars'].forEach((path) => {
      expect(cacheControlFor(path)).toBe('no-cache')
    })
  })

  it('does not let asset paths fall into no-cache', () => {
    ;['/assets/index-abc123.js', '/textures/2k_mars.jpg'].forEach((path) => {
      expect(cacheControlFor(path)).not.toBe('no-cache')
    })
  })

  it('sends security headers on every path', () => {
    ;['/', '/generate', '/assets/index-abc123.js', '/textures/2k_mars.jpg'].forEach((path) => {
      const headers = effectiveHeaders(path)
      expect(headers.get('x-content-type-options')).toBe('nosniff')
      expect(headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin')
      expect(headers.get('x-frame-options')).toBe('DENY')
      expect(headers.get('strict-transport-security')).toBe('max-age=63072000; includeSubDomains')
      const permissions = headers.get('permissions-policy') ?? ''
      ;['camera=()', 'microphone=()', 'geolocation=()', 'payment=()'].forEach((directive) => {
        expect(permissions).toContain(directive)
      })
    })
  })

  it('ships CSP in Report-Only mode only, allowing cross-origin API calls', () => {
    const headers = effectiveHeaders('/')
    expect(headers.has('content-security-policy')).toBe(false)
    const csp = headers.get('content-security-policy-report-only') ?? ''
    const directives = new Map(
      csp
        .split(';')
        .map((part) => part.trim())
        .filter((part) => part.length > 0)
        .map((part): [string, string[]] => {
          const [name, ...values] = part.split(/\s+/)
          return [name, values]
        }),
    )
    expect(directives.get('default-src')).toEqual(["'self'"])
    expect(directives.get('script-src')).toEqual(["'self'"])
    expect(directives.get('connect-src')).toEqual(expect.arrayContaining(["'self'", 'https:']))
    expect(directives.get('worker-src')).toEqual(expect.arrayContaining(['blob:']))
    expect(directives.get('object-src')).toEqual(["'none'"])
    expect(directives.get('frame-ancestors')).toEqual(["'none'"])
  })
})
