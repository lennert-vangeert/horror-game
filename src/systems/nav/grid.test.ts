import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import {
  buildCollider,
  CELL,
  cellCenterX,
  cellCenterZ,
  hasLineOfSight,
  isFloor,
  makeGrid,
  setFloor,
  wallsBetween,
  worldToCellX,
  worldToCellZ,
  type Grid,
} from './grid'

function open(w: number, h: number): Grid {
  const g = makeGrid(w, h)
  for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) setFloor(g, x, z, true)
  return g
}

describe('wallsBetween / line of sight', () => {
  it('is clear across open floor', () => {
    const g = open(10, 10)
    expect(wallsBetween(g, cellCenterX(1), cellCenterZ(1), cellCenterX(8), cellCenterZ(1))).toBe(0)
    expect(hasLineOfSight(g, cellCenterX(1), cellCenterZ(5), cellCenterX(8), cellCenterZ(5))).toBe(true)
  })

  it('counts a solid cell between endpoints and blocks LOS', () => {
    const g = open(10, 10)
    setFloor(g, 5, 5, false) // wall in the middle
    const a = { x: cellCenterX(2), z: cellCenterZ(5) }
    const b = { x: cellCenterX(8), z: cellCenterZ(5) }
    expect(wallsBetween(g, a.x, a.z, b.x, b.z)).toBeGreaterThan(0)
    expect(hasLineOfSight(g, a.x, a.z, b.x, b.z)).toBe(false)
  })

  it('is symmetric', () => {
    const g = open(12, 12)
    setFloor(g, 6, 6, false)
    setFloor(g, 6, 7, false)
    const a = { x: cellCenterX(2), z: cellCenterZ(6) }
    const b = { x: cellCenterX(10), z: cellCenterZ(8) }
    expect(wallsBetween(g, a.x, a.z, b.x, b.z)).toBe(wallsBetween(g, b.x, b.z, a.x, a.z))
  })
})

describe('circle-vs-grid collider', () => {
  it('keeps the player out of solid cells', () => {
    const g = open(6, 6)
    setFloor(g, 3, 3, false) // one wall block
    const collide = buildCollider(g)

    // Aim the player from an open cell straight into the wall cell.
    const pos = new Vector3(cellCenterX(2), 1.6, cellCenterZ(3))
    for (let i = 0; i < 40; i++) {
      pos.x += 0.2 // march toward +x into the wall
      collide(pos, 0.35)
    }
    // It must never have ended up inside the solid cell.
    expect(isFloor(g, worldToCellX(pos.x), worldToCellZ(pos.z))).toBe(true)
    // And it should be stopped roughly a radius before the wall's left face (x = 9).
    expect(pos.x).toBeLessThanOrEqual(3 * CELL - 0.35 + 1e-3)
  })
})
