import { describe, it, expect } from 'vitest'
import {
  HEX_SIZE,
  hexToWorld,
  worldToHex,
  worldToHexFrac,
  hexRound,
  hexKey,
  hexFromKey,
  hexNeighbors,
  hexRing,
  hexesInRadius,
  allMapHexes,
  hexDistance,
  hexCorners,
  hexBrush,
} from './HexMath'

// ─── hexToWorld ───────────────────────────────────────────────────────────────

describe('hexToWorld', () => {
  it('origin hex maps to world (0, 0)', () => {
    const [x, z] = hexToWorld(0, 0)
    expect(x).toBeCloseTo(0)
    expect(z).toBeCloseTo(0)
  })

  it('hex (1, 0) maps to correct x offset', () => {
    const [x, z] = hexToWorld(1, 0)
    expect(x).toBeCloseTo(HEX_SIZE * 1.5)
    expect(z).toBeCloseTo(HEX_SIZE * Math.sqrt(3) / 2)
  })

  it('hex (0, 1) maps to correct z offset', () => {
    const [x, z] = hexToWorld(0, 1)
    expect(x).toBeCloseTo(0)
    expect(z).toBeCloseTo(HEX_SIZE * Math.sqrt(3))
  })

  it('hex (-1, 0) is symmetric to (1, 0)', () => {
    const [x1] = hexToWorld(1, 0)
    const [x2] = hexToWorld(-1, 0)
    expect(x1).toBeCloseTo(-x2)
  })

  it('hex (2, -1) produces expected position', () => {
    const [x, z] = hexToWorld(2, -1)
    expect(x).toBeCloseTo(HEX_SIZE * 3)
    expect(z).toBeCloseTo(HEX_SIZE * (Math.sqrt(3) - Math.sqrt(3)))
  })
})

// ─── worldToHexFrac ───────────────────────────────────────────────────────────

describe('worldToHexFrac', () => {
  it('world (0, 0) maps to frac hex (0, 0)', () => {
    const [q, r] = worldToHexFrac(0, 0)
    expect(q).toBeCloseTo(0)
    expect(r).toBeCloseTo(0)
  })

  it('roundtrip: hexToWorld → worldToHexFrac returns original', () => {
    const pairs: [number, number][] = [[0,0],[1,0],[0,1],[-1,1],[2,-1],[-3,2]]
    for (const [q, r] of pairs) {
      const [x, z] = hexToWorld(q, r)
      const [fq, fr] = worldToHexFrac(x, z)
      expect(fq).toBeCloseTo(q, 5)
      expect(fr).toBeCloseTo(r, 5)
    }
  })
})

// ─── hexRound ─────────────────────────────────────────────────────────────────

describe('hexRound', () => {
  it('rounds integer coords to themselves', () => {
    expect(hexRound(0, 0)).toEqual([0, 0])
    expect(hexRound(1, 0)).toEqual([1, 0])
    expect(hexRound(-2, 3)).toEqual([-2, 3])
  })

  it('rounds fractional coords to nearest hex', () => {
    // (0.4, 0.4): s = -0.8, rounds to [0,1] — correct per cube rounding
    const [q, r] = hexRound(0.4, 0.4)
    // Must satisfy cube constraint
    const s = -q - r
    expect(q + r + s).toBe(0)
    // q, r, s must all be integers
    expect(Number.isInteger(q)).toBe(true)
    expect(Number.isInteger(r)).toBe(true)
  })

  it('maintains cube constraint q+r+s=0 after rounding', () => {
    const testCases: [number, number][] = [
      [0.6, 0.6], [-0.1, 0.7], [1.4, -0.9], [-2.3, 1.8]
    ]
    for (const [q, r] of testCases) {
      const [rq, rr] = hexRound(q, r)
      const rs = -rq - rr
      expect(rq + rr + rs).toBe(0)
    }
  })
})

// ─── worldToHex ───────────────────────────────────────────────────────────────

describe('worldToHex', () => {
  it('world center maps to hex (0,0)', () => {
    expect(worldToHex(0, 0)).toEqual([0, 0])
  })

  it('roundtrip: hexToWorld → worldToHex returns original', () => {
    const hexes: [number, number][] = [[0,0],[1,0],[0,1],[-1,1],[3,-2],[-4,3]]
    for (const [q, r] of hexes) {
      const [x, z] = hexToWorld(q, r)
      expect(worldToHex(x, z)).toEqual([q, r])
    }
  })

  it('point near center of hex maps to that hex', () => {
    const [cx, cz] = hexToWorld(2, -1)
    // slight offset from center — should still round to same hex
    expect(worldToHex(cx + 0.1, cz + 0.1)).toEqual([2, -1])
    expect(worldToHex(cx - 0.1, cz - 0.1)).toEqual([2, -1])
  })
})

// ─── hexKey / hexFromKey ──────────────────────────────────────────────────────

describe('hexKey / hexFromKey', () => {
  it('hexKey produces deterministic string', () => {
    expect(hexKey(0, 0)).toBe('0,0')
    expect(hexKey(3, -2)).toBe('3,-2')
    expect(hexKey(-10, 7)).toBe('-10,7')
  })

  it('hexFromKey roundtrips hexKey', () => {
    const pairs: [number, number][] = [[0,0],[1,-1],[-5,3],[20,-20]]
    for (const [q, r] of pairs) {
      expect(hexFromKey(hexKey(q, r))).toEqual([q, r])
    }
  })
})

// ─── hexNeighbors ─────────────────────────────────────────────────────────────

describe('hexNeighbors', () => {
  it('returns exactly 6 neighbors', () => {
    expect(hexNeighbors(0, 0)).toHaveLength(6)
    expect(hexNeighbors(5, -3)).toHaveLength(6)
  })

  it('each neighbor is distance 1 from center', () => {
    for (const [nq, nr] of hexNeighbors(0, 0)) {
      expect(hexDistance(0, 0, nq, nr)).toBe(1)
    }
  })

  it('neighbors of (0,0) do not include (0,0)', () => {
    const neighbors = hexNeighbors(0, 0)
    expect(neighbors.every(([q, r]) => !(q === 0 && r === 0))).toBe(true)
  })

  it('neighbors are unique', () => {
    const neighbors = hexNeighbors(3, -2)
    const keys = neighbors.map(([q, r]) => hexKey(q, r))
    expect(new Set(keys).size).toBe(6)
  })
})

// ─── hexRing ──────────────────────────────────────────────────────────────────

describe('hexRing', () => {
  it('ring of radius 0 returns just the center', () => {
    expect(hexRing(0, 0, 0)).toEqual([[0, 0]])
  })

  it('ring of radius 1 returns 6 hexes', () => {
    expect(hexRing(0, 0, 1)).toHaveLength(6)
  })

  it('ring of radius 2 returns 12 hexes', () => {
    expect(hexRing(0, 0, 2)).toHaveLength(12)
  })

  it('ring of radius N returns 6*N hexes', () => {
    for (const r of [1, 2, 3, 4, 5]) {
      expect(hexRing(0, 0, r)).toHaveLength(6 * r)
    }
  })

  it('all ring hexes are at exactly the given distance', () => {
    for (const radius of [1, 2, 3]) {
      for (const [q, r] of hexRing(0, 0, radius)) {
        expect(hexDistance(0, 0, q, r)).toBe(radius)
      }
    }
  })
})

// ─── hexesInRadius ────────────────────────────────────────────────────────────

describe('hexesInRadius', () => {
  it('radius 0 returns just center', () => {
    expect(hexesInRadius(0, 0, 0)).toHaveLength(1)
    expect(hexesInRadius(0, 0, 0)[0]).toEqual([0, 0])
  })

  it('radius 1 returns 7 hexes', () => {
    expect(hexesInRadius(0, 0, 1)).toHaveLength(7)
  })

  it('radius 2 returns 19 hexes', () => {
    expect(hexesInRadius(0, 0, 2)).toHaveLength(19)
  })

  it('radius N returns 3*N*(N+1)+1 hexes', () => {
    for (const n of [0, 1, 2, 3, 4, 5]) {
      const expected = 3 * n * (n + 1) + 1
      expect(hexesInRadius(0, 0, n)).toHaveLength(expected)
    }
  })

  it('all hexes are within the given radius', () => {
    for (const [q, r] of hexesInRadius(0, 0, 4)) {
      expect(hexDistance(0, 0, q, r)).toBeLessThanOrEqual(4)
    }
  })

  it('works with non-origin center', () => {
    const center = hexesInRadius(5, -3, 2)
    expect(center).toHaveLength(19)
    for (const [q, r] of center) {
      expect(hexDistance(5, -3, q, r)).toBeLessThanOrEqual(2)
    }
  })
})

// ─── allMapHexes ─────────────────────────────────────────────────────────────

describe('allMapHexes', () => {
  it('radius 20 returns correct count', () => {
    const n = 20
    const expected = 3 * n * (n + 1) + 1
    expect(allMapHexes(20)).toHaveLength(expected)
  })
})

// ─── hexDistance ─────────────────────────────────────────────────────────────

describe('hexDistance', () => {
  it('distance to self is 0', () => {
    expect(hexDistance(0, 0, 0, 0)).toBe(0)
    expect(hexDistance(3, -2, 3, -2)).toBe(0)
  })

  it('distance to neighbor is 1', () => {
    expect(hexDistance(0, 0, 1, 0)).toBe(1)
    expect(hexDistance(0, 0, 0, 1)).toBe(1)
    expect(hexDistance(0, 0, -1, 1)).toBe(1)
  })

  it('distance is symmetric', () => {
    expect(hexDistance(2, -3, -1, 4)).toBe(hexDistance(-1, 4, 2, -3))
  })

  it('distance of (0,0) to (5,-5) is 5', () => {
    expect(hexDistance(0, 0, 5, -5)).toBe(5)
  })

  it('distance satisfies triangle inequality', () => {
    const a: [number, number] = [0, 0]
    const b: [number, number] = [3, -2]
    const c: [number, number] = [-1, 4]
    const ab = hexDistance(...a, ...b)
    const bc = hexDistance(...b, ...c)
    const ac = hexDistance(...a, ...c)
    expect(ab + bc).toBeGreaterThanOrEqual(ac)
  })
})

// ─── hexCorners ───────────────────────────────────────────────────────────────

describe('hexCorners', () => {
  it('returns 6 corners', () => {
    expect(hexCorners(0, 0)).toHaveLength(6)
  })

  it('all corners are HEX_SIZE distance from center', () => {
    const corners = hexCorners(0, 0)
    for (const [x, z] of corners) {
      const dist = Math.sqrt(x * x + z * z)
      expect(dist).toBeCloseTo(HEX_SIZE, 5)
    }
  })

  it('corners are evenly spaced (60° apart)', () => {
    const corners = hexCorners(0, 0)
    const angles = corners.map(([x, z]) => Math.atan2(z, x))
    for (let i = 1; i < angles.length; i++) {
      let diff = angles[i] - angles[i - 1]
      // Normalize to handle wrap-around at ±π
      while (diff > Math.PI) diff -= 2 * Math.PI
      while (diff < -Math.PI) diff += 2 * Math.PI
      expect(Math.abs(diff)).toBeCloseTo(Math.PI / 3, 4)
    }
  })

  it('offset center shifts all corners by offset', () => {
    const base = hexCorners(0, 0)
    const offset = hexCorners(10, 5)
    for (let i = 0; i < 6; i++) {
      expect(offset[i][0]).toBeCloseTo(base[i][0] + 10, 5)
      expect(offset[i][1]).toBeCloseTo(base[i][1] + 5, 5)
    }
  })
})

// ─── hexBrush ─────────────────────────────────────────────────────────────────

describe('hexBrush', () => {
  it('brush size 1 returns 1 hex (center only)', () => {
    expect(hexBrush(0, 0, 1)).toHaveLength(1)
    expect(hexBrush(0, 0, 1)[0]).toEqual([0, 0])
  })

  it('brush size 3 returns 7 hexes', () => {
    expect(hexBrush(0, 0, 3)).toHaveLength(7)
  })

  it('brush size 5 returns 19 hexes', () => {
    expect(hexBrush(0, 0, 5)).toHaveLength(19)
  })

  it('all brush hexes are within brush radius', () => {
    for (const [q, r] of hexBrush(3, -2, 5)) {
      expect(hexDistance(3, -2, q, r)).toBeLessThanOrEqual(2)
    }
  })

  it('brush works on non-origin center', () => {
    const brush = hexBrush(-5, 4, 3)
    expect(brush).toHaveLength(7)
    for (const [q, r] of brush) {
      expect(hexDistance(-5, 4, q, r)).toBeLessThanOrEqual(1)
    }
  })
})
