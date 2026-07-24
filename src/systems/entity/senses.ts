// entity/senses.ts
// What the entity knows about the player. Sight (LOS within range) grants fresh
// knowledge; otherwise knowledge ages and eventually goes stale (ai uses loseInterest).
// Noise-driven knowledge is layered in at M3 via noise.ts.

import { Vector3 } from 'three'
import { hasLineOfSight, worldToCellX, worldToCellZ, type Cell, type Grid } from '../nav/grid'

export const senses = {
  canSeePlayer: false,
  lastKnownCell: null as Cell | null,
  knowledgeAge: Infinity, // seconds since last confirmed sighting
}

const SIGHT_RANGE = 32 // m

export function resetSenses(): void {
  senses.canSeePlayer = false
  senses.lastKnownCell = null
  senses.knowledgeAge = Infinity
}

export function updateSenses(dt: number, grid: Grid, entityPos: Vector3, playerPos: Vector3): void {
  const dx = playerPos.x - entityPos.x
  const dz = playerPos.z - entityPos.z
  const dist = Math.hypot(dx, dz)
  const see = dist <= SIGHT_RANGE && hasLineOfSight(grid, entityPos.x, entityPos.z, playerPos.x, playerPos.z)

  senses.canSeePlayer = see
  if (see) {
    senses.lastKnownCell = { x: worldToCellX(playerPos.x), z: worldToCellZ(playerPos.z) }
    senses.knowledgeAge = 0
  } else {
    senses.knowledgeAge += dt
  }
}

/** Feed an external knowledge refresh (e.g. a heard noise). Used from M3 onward. */
export function noticeAt(cell: Cell): void {
  senses.lastKnownCell = { x: cell.x, z: cell.z }
  senses.knowledgeAge = 0
}
