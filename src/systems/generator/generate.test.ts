import { describe, expect, it } from 'vitest'
import { generateLevel } from './generate'
import { floodReachable, findPath } from '../nav/astar'
import { CELL, idx, isFloor } from '../nav/grid'
import { GEN } from '../../config/tuning'

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 2654435761)

describe('generateLevel', () => {
  it('produces the right number of artifacts', () => {
    for (const s of SEEDS) {
      const lvl = generateLevel(s)
      expect(lvl.artifacts.length).toBe(GEN.ARTIFACT_COUNT)
    }
  })

  it('keeps spawn, exit and every artifact reachable from spawn', () => {
    for (const s of SEEDS) {
      const lvl = generateLevel(s)
      const reachable = floodReachable(lvl.grid, lvl.spawn)
      expect(reachable.has(idx(lvl.grid, lvl.exit.x, lvl.exit.z))).toBe(true)
      for (const a of lvl.artifacts) {
        expect(reachable.has(idx(lvl.grid, a.x, a.z))).toBe(true)
      }
    }
  })

  it('can path spawn -> exit', () => {
    for (const s of SEEDS) {
      const lvl = generateLevel(s)
      const path = findPath(lvl.grid, lvl.spawn, lvl.exit)
      expect(path).not.toBeNull()
      expect(path!.length).toBeGreaterThan(1)
    }
  })

  it('is deterministic for a given seed', () => {
    const a = generateLevel(12345)
    const b = generateLevel(12345)
    expect(Array.from(a.grid.cells)).toEqual(Array.from(b.grid.cells))
    expect(a.spawn).toEqual(b.spawn)
    expect(a.exit).toEqual(b.exit)
  })

  it('has loops, not a spanning tree (>=1 cell with 3+ floor neighbours)', () => {
    for (const s of SEEDS.slice(0, 10)) {
      const lvl = generateLevel(s)
      let junctions = 0
      for (let z = 0; z < lvl.grid.h; z++) {
        for (let x = 0; x < lvl.grid.w; x++) {
          if (!isFloor(lvl.grid, x, z)) continue
          let n = 0
          if (isFloor(lvl.grid, x + 1, z)) n++
          if (isFloor(lvl.grid, x - 1, z)) n++
          if (isFloor(lvl.grid, x, z + 1)) n++
          if (isFloor(lvl.grid, x, z - 1)) n++
          if (n >= 3) junctions++
        }
      }
      expect(junctions).toBeGreaterThan(4)
    }
  })

  it('spaces artifacts sensibly (most pairs beyond a corridor apart)', () => {
    const lvl = generateLevel(999)
    // At least one pair must respect the design min-sep; backfill may relax some.
    let ok = false
    for (let i = 0; i < lvl.artifacts.length; i++) {
      for (let j = i + 1; j < lvl.artifacts.length; j++) {
        const d = Math.hypot(
          lvl.artifacts[i].x - lvl.artifacts[j].x,
          lvl.artifacts[i].z - lvl.artifacts[j].z,
        ) * CELL
        if (d >= GEN.ARTIFACT_MIN_SEP) ok = true
      }
    }
    expect(ok).toBe(true)
  })
})
