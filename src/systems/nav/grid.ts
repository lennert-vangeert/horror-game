// grid.ts
// The wall grid — one Uint8Array where 1 = floor (walkable) and 0 = solid (wall volume).
// This single structure serves three consumers: rendering (instanced tiles), collision
// (circle-vs-grid), and occlusion/LOS (wallsBetween). Solid cells ARE the walls: 3 m
// blocks, which is exactly the blocky PSX look we want.

import { Vector3 } from 'three'
import { AUDIO_OCCLUSION, WORLD } from '../../config/tuning'
import type { CollideFn } from '../player'

export interface Cell {
  x: number
  z: number
}

export interface Grid {
  w: number
  h: number
  cells: Uint8Array // row-major, z * w + x; 1 = floor, 0 = solid
}

export const CELL = WORLD.CELL

export function makeGrid(w: number, h: number): Grid {
  return { w, h, cells: new Uint8Array(w * h) }
}

export const idx = (g: Grid, x: number, z: number) => z * g.w + x

export function inBounds(g: Grid, x: number, z: number): boolean {
  return x >= 0 && z >= 0 && x < g.w && z < g.h
}

export function isFloor(g: Grid, x: number, z: number): boolean {
  return inBounds(g, x, z) && g.cells[idx(g, x, z)] === 1
}

/** Everything out of bounds is solid, so the grid border acts as the outer wall. */
export function isSolid(g: Grid, x: number, z: number): boolean {
  return !isFloor(g, x, z)
}

export function setFloor(g: Grid, x: number, z: number, v = true): void {
  if (inBounds(g, x, z)) g.cells[idx(g, x, z)] = v ? 1 : 0
}

// --- cell <-> world ---
export const cellCenterX = (cx: number) => (cx + 0.5) * CELL
export const cellCenterZ = (cz: number) => (cz + 0.5) * CELL
export const worldToCellX = (x: number) => Math.floor(x / CELL)
export const worldToCellZ = (z: number) => Math.floor(z / CELL)
export const cellCenterWorld = (c: Cell) => new Vector3(cellCenterX(c.x), 0, cellCenterZ(c.z))

export function floorNeighbourCount(g: Grid, x: number, z: number): number {
  let n = 0
  if (isFloor(g, x + 1, z)) n++
  if (isFloor(g, x - 1, z)) n++
  if (isFloor(g, x, z + 1)) n++
  if (isFloor(g, x, z - 1)) n++
  return n
}

/**
 * Number of solid cells the segment A→B passes through, excluding the two endpoint
 * cells. Amanatides–Woo grid traversal. Used by both LOS (blocked iff > 0) and audio
 * occlusion (bucketed). Allocation-free.
 */
export function wallsBetween(g: Grid, ax: number, az: number, bx: number, bz: number): number {
  const x0 = ax / CELL
  const z0 = az / CELL
  const x1 = bx / CELL
  const z1 = bz / CELL
  let cx = Math.floor(x0)
  let cz = Math.floor(z0)
  const ex = Math.floor(x1)
  const ez = Math.floor(z1)
  const dx = x1 - x0
  const dz = z1 - z0
  const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0
  const stepZ = dz > 0 ? 1 : dz < 0 ? -1 : 0
  const tDX = dx !== 0 ? Math.abs(1 / dx) : Infinity
  const tDZ = dz !== 0 ? Math.abs(1 / dz) : Infinity
  let tMX = dx !== 0 ? (stepX > 0 ? cx + 1 - x0 : x0 - cx) * tDX : Infinity
  let tMZ = dz !== 0 ? (stepZ > 0 ? cz + 1 - z0 : z0 - cz) * tDZ : Infinity

  let walls = 0
  let guard = 0
  while (!(cx === ex && cz === ez) && guard++ < 8192) {
    if (tMX < tMZ) {
      cx += stepX
      tMX += tDX
    } else {
      cz += stepZ
      tMZ += tDZ
    }
    if (cx === ex && cz === ez) break
    if (isSolid(g, cx, cz)) walls++
  }
  return walls
}

export function hasLineOfSight(g: Grid, ax: number, az: number, bx: number, bz: number): boolean {
  return wallsBetween(g, ax, az, bx, bz) === 0
}

export function occlusionFor(walls: number) {
  return AUDIO_OCCLUSION[Math.min(walls, AUDIO_OCCLUSION.length - 1)]
}

/**
 * Builds a circle-vs-grid resolver: pushes the player's position circle out of every
 * nearby solid cell (each an axis-aligned box), zeroing only the into-wall component so
 * you slide along walls. r (0.35 m) << CELL (3 m), so sequential resolution is stable.
 */
export function buildCollider(g: Grid): CollideFn {
  return (pos: Vector3, r: number) => {
    const minCx = worldToCellX(pos.x - r) - 1
    const maxCx = worldToCellX(pos.x + r) + 1
    const minCz = worldToCellZ(pos.z - r) - 1
    const maxCz = worldToCellZ(pos.z + r) + 1

    for (let cz = minCz; cz <= maxCz; cz++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        if (isFloor(g, cx, cz)) continue // walkable cells don't collide

        const minX = cx * CELL
        const maxX = minX + CELL
        const minZ = cz * CELL
        const maxZ = minZ + CELL

        const closestX = Math.min(Math.max(pos.x, minX), maxX)
        const closestZ = Math.min(Math.max(pos.z, minZ), maxZ)
        const dx = pos.x - closestX
        const dz = pos.z - closestZ
        const d2 = dx * dx + dz * dz

        if (d2 > r * r) continue

        if (d2 > 1e-8) {
          const d = Math.sqrt(d2)
          const push = r - d
          pos.x += (dx / d) * push
          pos.z += (dz / d) * push
        } else {
          // Center is inside the cell — push out along the least-penetration axis.
          const toLeft = pos.x - minX
          const toRight = maxX - pos.x
          const toNear = pos.z - minZ
          const toFar = maxZ - pos.z
          const m = Math.min(toLeft, toRight, toNear, toFar)
          if (m === toLeft) pos.x = minX - r
          else if (m === toRight) pos.x = maxX + r
          else if (m === toNear) pos.z = minZ - r
          else pos.z = maxZ + r
        }
      }
    }
  }
}
