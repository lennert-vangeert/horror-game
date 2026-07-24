// astar.ts
// A* over floor cells (orthogonal moves, unit cost, Manhattan heuristic) plus a flood
// fill for connectivity validation. Grids here are a few thousand cells and the entity
// repaths a handful of times per second, so a linear-scan open set is fine; swap for a
// binary heap only if profiling says so.

import { idx, isFloor, type Cell, type Grid } from './grid'

const heuristic = (a: Cell, b: Cell) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z)

export function findPath(g: Grid, start: Cell, goal: Cell): Cell[] | null {
  if (!isFloor(g, start.x, start.z) || !isFloor(g, goal.x, goal.z)) return null
  const w = g.w
  const startI = start.z * w + start.x
  const goalI = goal.z * w + goal.x
  if (startI === goalI) return [start]

  const open: number[] = [startI]
  const openSet = new Set<number>([startI])
  const came = new Map<number, number>()
  const gScore = new Map<number, number>([[startI, 0]])
  const fScore = new Map<number, number>([[startI, heuristic(start, goal)]])

  while (open.length) {
    // Pop the lowest-f node.
    let bestIdx = 0
    let bestF = Infinity
    for (let i = 0; i < open.length; i++) {
      const f = fScore.get(open[i]) ?? Infinity
      if (f < bestF) {
        bestF = f
        bestIdx = i
      }
    }
    const current = open.splice(bestIdx, 1)[0]
    openSet.delete(current)

    if (current === goalI) return reconstruct(came, current, w)

    const cx = current % w
    const cz = (current - cx) / w
    const neighbours: Array<[number, number]> = [
      [cx + 1, cz],
      [cx - 1, cz],
      [cx, cz + 1],
      [cx, cz - 1],
    ]

    const gCur = gScore.get(current) ?? Infinity
    for (const [nx, nz] of neighbours) {
      if (!isFloor(g, nx, nz)) continue
      const ni = nz * w + nx
      const tentative = gCur + 1
      if (tentative < (gScore.get(ni) ?? Infinity)) {
        came.set(ni, current)
        gScore.set(ni, tentative)
        fScore.set(ni, tentative + heuristic({ x: nx, z: nz }, goal))
        if (!openSet.has(ni)) {
          open.push(ni)
          openSet.add(ni)
        }
      }
    }
  }
  return null
}

function reconstruct(came: Map<number, number>, current: number, w: number): Cell[] {
  const path: Cell[] = []
  let c: number | undefined = current
  while (c !== undefined) {
    const x = c % w
    path.push({ x, z: (c - x) / w })
    c = came.get(c)
  }
  return path.reverse()
}

/** All floor cell indices reachable from `start` via orthogonal moves. */
export function floodReachable(g: Grid, start: Cell): Set<number> {
  const seen = new Set<number>()
  if (!isFloor(g, start.x, start.z)) return seen
  const w = g.w
  const stack = [start.z * w + start.x]
  seen.add(stack[0])
  while (stack.length) {
    const c = stack.pop() as number
    const cx = c % w
    const cz = (c - cx) / w
    const ns: Array<[number, number]> = [
      [cx + 1, cz],
      [cx - 1, cz],
      [cx, cz + 1],
      [cx, cz - 1],
    ]
    for (const [nx, nz] of ns) {
      if (!isFloor(g, nx, nz)) continue
      const ni = nz * w + nx
      if (!seen.has(ni)) {
        seen.add(ni)
        stack.push(ni)
      }
    }
  }
  return seen
}

export function isReachable(reachable: Set<number>, g: Grid, c: Cell): boolean {
  return reachable.has(idx(g, c.x, c.z))
}
