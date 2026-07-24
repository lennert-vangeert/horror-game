// generate.ts
// Prefab-chunk + corridor-weave generator (Spelunky model). A macro-grid of room slots;
// each slot gets a rotated chunk stamped in. Slots are connected by a randomized
// spanning tree of L-corridors, then extra edges are punched until the loop ratio clears
// the survivability bar (a pure tree is all coffins against a 6.5 m/s hunter). Finally
// spawn/exit/artifacts are placed and the whole thing is validated — reroll on failure.

import { GEN } from '../../config/tuning'
import { makeRng, type Rng } from '../rng'
import {
  CELL,
  cellCenterX,
  cellCenterZ,
  floorNeighbourCount,
  idx,
  isFloor,
  makeGrid,
  setFloor,
  type Cell,
  type Grid,
} from '../nav/grid'
import { floodReachable } from '../nav/astar'
import { CHUNKS, rotateRows } from './chunks'
import type { GeneratedLevel } from './types'

const { MACRO_W: MW, MACRO_H: MH, STRIDE, LOOP_RATIO_MIN, ARTIFACT_MIN_SEP, ARTIFACT_COUNT, REROLL_MAX } = GEN

const macroIdx = (mx: number, mz: number) => mz * MW + mx
const slotCentre = (mx: number, mz: number): Cell => ({ x: mx * STRIDE + 3, z: mz * STRIDE + 3 })

export function generateLevel(seed: number): GeneratedLevel {
  let last: GeneratedLevel | null = null
  for (let attempt = 0; attempt < REROLL_MAX; attempt++) {
    // Vary the seed per attempt so a reroll actually changes the layout.
    const lvl = attemptGenerate((seed + attempt * 0x9e3779b9) >>> 0, seed)
    last = lvl
    if (validate(lvl)) return lvl
  }
  // Extremely unlikely: hand back the last attempt rather than crash the run.
  return last as GeneratedLevel
}

function attemptGenerate(rngSeed: number, levelSeed: number): GeneratedLevel {
  const rng = makeRng(rngSeed)
  const w = MW * STRIDE + 1
  const h = MH * STRIDE + 1
  const grid = makeGrid(w, h)

  const rooms: Cell[] = []
  for (let mz = 0; mz < MH; mz++) {
    for (let mx = 0; mx < MW; mx++) {
      stampChunk(grid, mx * STRIDE + 1, mz * STRIDE + 1, rng)
      const c = slotCentre(mx, mz)
      setFloor(grid, c.x, c.z, true) // guarantee a hook point for corridors
      rooms.push(c)
    }
  }

  const edges = carveSpanningTree(grid, rng)
  punchLoops(grid, rng, edges)

  // Spawn in a corner slot; exit in the slot farthest from it (traverse the whole map).
  const spawn = slotCentre(0, 0)
  let exit = spawn
  let bestD = -1
  for (let mz = 0; mz < MH; mz++) {
    for (let mx = 0; mx < MW; mx++) {
      const c = slotCentre(mx, mz)
      const d = Math.abs(c.x - spawn.x) + Math.abs(c.z - spawn.z)
      if (d > bestD) {
        bestD = d
        exit = c
      }
    }
  }

  const artifacts = placeArtifacts(rng, rooms, spawn, exit)

  return { grid, spawn, exit, artifacts, rooms, seed: levelSeed }
}

function stampChunk(grid: Grid, ox: number, oz: number, rng: Rng): void {
  const chunk = rng.pick(CHUNKS)
  const rows = rotateRows(chunk.rows, rng.int(4))
  for (let z = 0; z < rows.length; z++) {
    const row = rows[z]
    for (let x = 0; x < row.length; x++) {
      if (row[x] === '.') setFloor(grid, ox + x, oz + z, true)
    }
  }
}

/** Carve a floor L-corridor between two cells (horizontal leg, then vertical leg). */
function carveCorridor(grid: Grid, a: Cell, b: Cell): void {
  const x0 = Math.min(a.x, b.x)
  const x1 = Math.max(a.x, b.x)
  for (let x = x0; x <= x1; x++) setFloor(grid, x, a.z, true)
  const z0 = Math.min(a.z, b.z)
  const z1 = Math.max(a.z, b.z)
  for (let z = z0; z <= z1; z++) setFloor(grid, b.x, z, true)
}

interface MacroEdge {
  a: number
  b: number
}

/** Randomized DFS spanning tree over the macro-grid; carve a corridor per tree edge. */
function carveSpanningTree(grid: Grid, rng: Rng): Set<string> {
  const visited = new Set<number>()
  const edges = new Set<string>()
  const stack: Array<{ mx: number; mz: number }> = [{ mx: 0, mz: 0 }]
  visited.add(macroIdx(0, 0))

  while (stack.length) {
    const cur = stack[stack.length - 1]
    const neighbours = macroNeighbours(cur.mx, cur.mz).filter((n) => !visited.has(macroIdx(n.mx, n.mz)))
    if (neighbours.length === 0) {
      stack.pop()
      continue
    }
    const next = neighbours[rng.int(neighbours.length)]
    visited.add(macroIdx(next.mx, next.mz))
    edges.add(edgeKey(macroIdx(cur.mx, cur.mz), macroIdx(next.mx, next.mz)))
    carveCorridor(grid, slotCentre(cur.mx, cur.mz), slotCentre(next.mx, next.mz))
    stack.push(next)
  }
  return edges
}

/** Add non-tree adjacencies (each creates a loop) until the loop ratio clears the bar. */
function punchLoops(grid: Grid, rng: Rng, edges: Set<string>): void {
  const nodes = MW * MH
  const candidates: MacroEdge[] = []
  for (let mz = 0; mz < MH; mz++) {
    for (let mx = 0; mx < MW; mx++) {
      const a = macroIdx(mx, mz)
      for (const n of macroNeighbours(mx, mz)) {
        const b = macroIdx(n.mx, n.mz)
        if (a < b && !edges.has(edgeKey(a, b))) candidates.push({ a, b })
      }
    }
  }
  rng.shuffle(candidates)

  const loopRatio = () => (edges.size - (nodes - 1)) / nodes
  let ci = 0
  while (loopRatio() < LOOP_RATIO_MIN && ci < candidates.length) {
    const e = candidates[ci++]
    edges.add(edgeKey(e.a, e.b))
    carveCorridor(grid, macroCentreFromIdx(e.a), macroCentreFromIdx(e.b))
  }
}

function placeArtifacts(rng: Rng, rooms: Cell[], spawn: Cell, exit: Cell): Cell[] {
  const minSepCells = ARTIFACT_MIN_SEP / CELL
  const candidates = rng.shuffle(
    rooms.filter((r) => !sameCell(r, spawn) && !sameCell(r, exit)),
  )
  const chosen: Cell[] = []
  for (const c of candidates) {
    if (chosen.length >= ARTIFACT_COUNT) break
    if (chosen.every((o) => cellDist(o, c) >= minSepCells)) chosen.push(c)
  }
  // If the separation constraint starved us (small maps), backfill with whatever's left.
  for (const c of candidates) {
    if (chosen.length >= ARTIFACT_COUNT) break
    if (!chosen.some((o) => sameCell(o, c))) chosen.push(c)
  }
  return chosen
}

function validate(lvl: GeneratedLevel): boolean {
  const reachable = floodReachable(lvl.grid, lvl.spawn)
  if (!reachable.has(idx(lvl.grid, lvl.exit.x, lvl.exit.z))) return false
  for (const a of lvl.artifacts) {
    if (!reachable.has(idx(lvl.grid, a.x, a.z))) return false
  }
  if (lvl.artifacts.length < ARTIFACT_COUNT) return false
  if (maxDeadEndDepth(lvl.grid) > GEN.DEAD_END_MAX + 1) return false
  return true
}

/**
 * Worst dead-end chain length. A dead end is a floor cell with exactly one floor
 * neighbour; we walk the corridor stub until it opens out and record the longest.
 */
function maxDeadEndDepth(grid: Grid): number {
  let worst = 0
  for (let z = 0; z < grid.h; z++) {
    for (let x = 0; x < grid.w; x++) {
      if (!isFloor(grid, x, z)) continue
      if (floorNeighbourCount(grid, x, z) !== 1) continue
      // Walk the stub.
      let px = -1
      let pz = -1
      let cx = x
      let cz = z
      let depth = 1
      while (depth < 64) {
        const next = onlyFloorNeighbourExcept(grid, cx, cz, px, pz)
        if (!next || floorNeighbourCount(grid, next.x, next.z) > 2) break
        px = cx
        pz = cz
        cx = next.x
        cz = next.z
        depth++
      }
      if (depth > worst) worst = depth
    }
  }
  return worst
}

function onlyFloorNeighbourExcept(g: Grid, x: number, z: number, px: number, pz: number): Cell | null {
  const ns: Cell[] = [
    { x: x + 1, z },
    { x: x - 1, z },
    { x, z: z + 1 },
    { x, z: z - 1 },
  ]
  for (const n of ns) {
    if (n.x === px && n.z === pz) continue
    if (isFloor(g, n.x, n.z)) return n
  }
  return null
}

// --- small helpers ---
function macroNeighbours(mx: number, mz: number): Array<{ mx: number; mz: number }> {
  const out: Array<{ mx: number; mz: number }> = []
  if (mx + 1 < MW) out.push({ mx: mx + 1, mz })
  if (mx - 1 >= 0) out.push({ mx: mx - 1, mz })
  if (mz + 1 < MH) out.push({ mx, mz: mz + 1 })
  if (mz - 1 >= 0) out.push({ mx, mz: mz - 1 })
  return out
}

const macroCentreFromIdx = (i: number): Cell => slotCentre(i % MW, Math.floor(i / MW))
const edgeKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`)
const sameCell = (a: Cell, b: Cell) => a.x === b.x && a.z === b.z
const cellDist = (a: Cell, b: Cell) => Math.hypot(a.x - b.x, a.z - b.z)

// World-space helpers used by callers placing things by cell.
export const artifactWorld = (c: Cell) => [cellCenterX(c.x), 0, cellCenterZ(c.z)] as const
