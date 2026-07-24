// entity/ai.ts
// The state machine — PATROL → INVESTIGATE → STALK → HUNT → GRAB — modulated by the
// aggression scalar (every threshold read from AGGRO). The STALK hold-distance is the
// death-spiral brake: at low aggression the entity shadows you but won't close, so heavy
// flicker reads as dread, not a doomed feedback loop. Across every state the quantum lock
// holds: it moves only while NOT observed.

import { Vector3 } from 'three'
import { AGGRO, WORLD } from '../../config/tuning'
import { makeRng, type Rng } from '../rng'
import {
  cellCenterX,
  cellCenterZ,
  isFloor,
  worldToCellX,
  worldToCellZ,
  type Cell,
  type Grid,
} from '../nav/grid'
import { findPath } from '../nav/astar'
import { playerState } from '../player'
import { entityState } from './state'
import { senses } from './senses'

const REPATH_INTERVAL = 0.4 // s
const HOLD_BAND = 1.5 * WORLD.CELL // m — hysteresis around the stalk hold distance
const DEBUG_TP_DIST = 3 // m — teleport-in-front debug distance

const _target = new Vector3()
let rng: Rng = makeRng(1)
let debugAggro = 0
let onGrab: (() => void) | null = null

export function resetAI(seed: number): void {
  rng = makeRng((seed ^ 0x51ed270b) >>> 0)
}
export function setOnGrab(cb: (() => void) | null): void {
  onGrab = cb
}
export function setDebugAggression(n: number): void {
  debugAggro = Math.max(-1, Math.min(4, n))
}
/** Debug: drop the entity ~DEBUG_TP_DIST in front of the player, facing them. */
export function debugTeleportInFront(): void {
  const yaw = playerState.yaw
  const fx = -Math.sin(yaw) // player forward basis (player.ts)
  const fz = -Math.cos(yaw)
  entityState.pos.set(playerState.pos.x + fx * DEBUG_TP_DIST, 0, playerState.pos.z + fz * DEBUG_TP_DIST)
  // Face the player (entity forward is -z).
  const dx = playerState.pos.x - entityState.pos.x
  const dz = playerState.pos.z - entityState.pos.z
  if (dx * dx + dz * dz > 1e-4) entityState.yaw = Math.atan2(-dx, -dz)
  entityState.path = null
  entityState.targetCell = null
}
export function getDebugAggression(): number {
  return debugAggro
}

export function updateEntity(
  dt: number,
  isObserved: boolean,
  grid: Grid,
  playerPos: Vector3,
  aggression: number,
): void {
  entityState.aggression = aggression
  entityState.frozen = isObserved

  const dist = Math.hypot(playerPos.x - entityState.pos.x, playerPos.z - entityState.pos.z)
  entityState.distToPlayer = dist

  // Debug freeze (leva aggression −1): hold dead still — no transitions, no movement, no grab.
  if (debugAggro < 0) {
    entityState.frozen = true
    return
  }

  const holdDist = AGGRO.holdDist[aggression]
  const speed = AGGRO.speed[aggression]
  const stalkToHunt = AGGRO.stalkToHunt[aggression]
  const loseInterest = AGGRO.loseInterest[aggression]
  const playerCell: Cell = { x: worldToCellX(playerPos.x), z: worldToCellZ(playerPos.z) }

  switch (entityState.state) {
    case 'patrol':
    case 'investigate':
      if (senses.canSeePlayer) {
        entityState.state = 'stalk'
        entityState.stalkTimer = 0
      } else {
        ensureWanderTarget(grid)
      }
      break

    case 'stalk':
      entityState.stalkTimer += dt
      if (senses.knowledgeAge > loseInterest) {
        entityState.state = 'patrol'
        entityState.targetCell = null
      } else if (entityState.stalkTimer > stalkToHunt) {
        entityState.state = 'hunt'
      } else if (dist > holdDist + HOLD_BAND && senses.lastKnownCell) {
        setTarget(senses.lastKnownCell) // approach to the hold distance
      } else if (dist < holdDist - HOLD_BAND) {
        setTarget(retreatCell(grid, playerPos)) // too close — back off
      } else {
        entityState.targetCell = null // hold and watch
      }
      break

    case 'hunt':
      if (dist < AGGRO.GRAB_DIST) {
        entityState.state = 'grab'
        onGrab?.()
      } else if (loseInterest !== Infinity && senses.knowledgeAge > loseInterest) {
        entityState.state = 'stalk'
        entityState.stalkTimer = 0
      } else {
        setTarget(senses.lastKnownCell ?? playerCell)
      }
      break

    case 'grab':
      // gameFlow drives the grab sequence; the entity holds still.
      break

    case 'flee':
      // Post-escape grace: run to the far side of the maze; no hunt/grab until the timer runs out.
      entityState.fleeTimer -= dt
      if (entityState.fleeTimer <= 0) {
        entityState.state = 'stalk'
        entityState.stalkTimer = 0
      } else {
        ensureFleeTarget(grid, playerPos)
      }
      break
  }

  // Always face the player (entity forward is -z, like the camera).
  const fdx = playerPos.x - entityState.pos.x
  const fdz = playerPos.z - entityState.pos.z
  if (fdx * fdx + fdz * fdz > 1e-4) entityState.yaw = Math.atan2(-fdx, -fdz)

  // Quantum lock: move only while unobserved (and not mid-grab).
  if (!isObserved && entityState.state !== 'grab') {
    entityState.repathTimer -= dt
    if (entityState.repathTimer <= 0) {
      recomputePath(grid)
      entityState.repathTimer = REPATH_INTERVAL
    }
    advanceAlongPath(dt, speed)
  }
}

// --- pathing / movement ---

function setTarget(cell: Cell): void {
  const t = entityState.targetCell
  if (!t || t.x !== cell.x || t.z !== cell.z) {
    entityState.targetCell = { x: cell.x, z: cell.z }
    entityState.repathTimer = 0 // repath now
  }
}

function ensureWanderTarget(grid: Grid): void {
  if (!entityState.targetCell || reachedTarget()) {
    entityState.targetCell = randomFloorCell(grid)
    entityState.repathTimer = 0
  }
}

function ensureFleeTarget(grid: Grid, playerPos: Vector3): void {
  if (entityState.targetCell && !reachedTarget()) return
  // Pick the farthest of several random floor cells — run to the other side of the maze.
  let best = randomFloorCell(grid)
  let bestD = -1
  for (let i = 0; i < AGGRO.FLEE_SAMPLES; i++) {
    const c = randomFloorCell(grid)
    const d = Math.hypot(cellCenterX(c.x) - playerPos.x, cellCenterZ(c.z) - playerPos.z)
    if (d > bestD) {
      bestD = d
      best = c
    }
  }
  setTarget(best)
}

function reachedTarget(): boolean {
  const t = entityState.targetCell
  if (!t) return true
  const dx = cellCenterX(t.x) - entityState.pos.x
  const dz = cellCenterZ(t.z) - entityState.pos.z
  return dx * dx + dz * dz < (WORLD.CELL * 0.5) ** 2
}

function recomputePath(grid: Grid): void {
  const to = entityState.targetCell
  if (!to) {
    entityState.path = null
    return
  }
  const from: Cell = { x: worldToCellX(entityState.pos.x), z: worldToCellZ(entityState.pos.z) }
  const path = findPath(grid, from, to)
  entityState.path = path
  entityState.pathIndex = path && path.length > 1 ? 1 : 0 // skip the cell we're already in
}

function advanceAlongPath(dt: number, speed: number): void {
  const path = entityState.path
  if (!path || entityState.pathIndex >= path.length) return
  const cell = path[entityState.pathIndex]
  _target.set(cellCenterX(cell.x), 0, cellCenterZ(cell.z))
  const dx = _target.x - entityState.pos.x
  const dz = _target.z - entityState.pos.z
  const d = Math.hypot(dx, dz)
  const step = speed * dt
  if (d <= step) {
    entityState.pos.x = _target.x
    entityState.pos.z = _target.z
    entityState.pathIndex++
  } else {
    entityState.pos.x += (dx / d) * step
    entityState.pos.z += (dz / d) * step
  }
}

function retreatCell(grid: Grid, playerPos: Vector3): Cell {
  const cx = worldToCellX(entityState.pos.x)
  const cz = worldToCellZ(entityState.pos.z)
  const neighbours: Cell[] = [
    { x: cx + 1, z: cz },
    { x: cx - 1, z: cz },
    { x: cx, z: cz + 1 },
    { x: cx, z: cz - 1 },
  ]
  let best: Cell = { x: cx, z: cz }
  let bestD = -1
  for (const n of neighbours) {
    if (!isFloor(grid, n.x, n.z)) continue
    const d = Math.hypot(cellCenterX(n.x) - playerPos.x, cellCenterZ(n.z) - playerPos.z)
    if (d > bestD) {
      bestD = d
      best = n
    }
  }
  return best
}

function randomFloorCell(grid: Grid): Cell {
  for (let i = 0; i < 64; i++) {
    const x = rng.int(grid.w)
    const z = rng.int(grid.h)
    if (isFloor(grid, x, z)) return { x, z }
  }
  // Fallback: linear scan.
  for (let z = 0; z < grid.h; z++) {
    for (let x = 0; x < grid.w; x++) {
      if (isFloor(grid, x, z)) return { x, z }
    }
  }
  return { x: 0, z: 0 }
}
