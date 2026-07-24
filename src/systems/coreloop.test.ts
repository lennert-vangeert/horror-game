import { beforeEach, describe, expect, it } from 'vitest'
import { PerspectiveCamera, Vector3 } from 'three'
import { BLINK, FLICKER } from '../config/tuning'
import { blinkState, resetBlink, updateBlink } from './blink'
import { flashlightState, resetFlashlight, updateFlashlight } from './flashlight'
import { observationState, updateObservation } from './observation'
import { cellCenterX, cellCenterZ, makeGrid, setFloor, type Grid } from './nav/grid'
import { entityState, resetEntityState } from './entity/state'
import { resetSenses, senses, updateSenses } from './entity/senses'
import { resetAI, setDebugAggression, updateEntity } from './entity/ai'

const openGrid = (w: number, h: number): Grid => {
  const g = makeGrid(w, h)
  for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) setFloor(g, x, z, true)
  return g
}

describe('blink', () => {
  beforeEach(() => resetBlink())

  it('drains at BASE when calm and faster when staring/close', () => {
    resetBlink()
    updateBlink(1, false, 0, false, 0)
    expect(blinkState.meter).toBeCloseTo(1 - BLINK.BASE, 5)

    resetBlink()
    updateBlink(1, true, 1, false, 0) // staring + point-blank
    expect(blinkState.meter).toBeCloseTo(1 - BLINK.BASE * BLINK.STARE_MULT * BLINK.PROX_MULT, 5)
  })

  it('voluntary blink closes the eyes then refills on reopen', () => {
    resetBlink()
    updateBlink(2, false, 0, false, 0) // drain some
    expect(blinkState.meter).toBeLessThan(1)
    updateBlink(0.016, false, 0, true, 100) // press blink
    expect(blinkState.blinking).toBe(true)
    updateBlink(0.016, false, 0, false, 100 + BLINK.VOLUNTARY_MS + 1) // past the blink
    expect(blinkState.blinking).toBe(false)
    expect(blinkState.meter).toBe(1)
  })

  it('forces a long blink when the meter empties', () => {
    resetBlink()
    updateBlink(30, false, 0, false, 0) // overdrain → empty
    expect(blinkState.meter).toBe(0)
    expect(blinkState.blinking).toBe(true)
    expect(blinkState.forced).toBe(true)
    updateBlink(0.016, false, 0, false, BLINK.FORCED_MS + 10) // reopen after forced window
    expect(blinkState.meter).toBe(1)
    expect(blinkState.forced).toBe(false)
  })

  it('micro-blinks flutter the eyes below the threshold', () => {
    resetBlink()
    updateBlink(20, false, 0, false, 0) // drain to ~0.2, under MICRO_THRESHOLD
    expect(blinkState.meter).toBeLessThan(BLINK.MICRO_THRESHOLD)
    expect(blinkState.blinking).toBe(true) // a micro-flutter fired
  })
})

describe('flashlight flicker', () => {
  it('is framerate independent (same total time → same intensity)', () => {
    resetFlashlight()
    for (let i = 0; i < 120; i++) updateFlashlight(1 / 120, 10, 'stalk', 0)
    const fine = flashlightState.intensity
    resetFlashlight()
    for (let i = 0; i < 30; i++) updateFlashlight(1 / 30, 10, 'stalk', 0)
    const coarse = flashlightState.intensity
    expect(fine).toBeCloseTo(coarse, 4)
  })

  it('never dips below the floor outside HUNT, but blacks out in HUNT up close', () => {
    resetFlashlight()
    let minStalk = Infinity
    for (let i = 0; i < 2000; i++) {
      updateFlashlight(1 / 60, 0, 'stalk', 0) // point-blank, deepest flicker
      minStalk = Math.min(minStalk, flashlightState.intensity)
    }
    expect(minStalk).toBeGreaterThanOrEqual(FLICKER.FLOOR - 1e-6)

    resetFlashlight()
    let minHunt = Infinity
    for (let i = 0; i < 2000; i++) {
      updateFlashlight(1 / 60, 0, 'hunt', 0)
      minHunt = Math.min(minHunt, flashlightState.intensity)
    }
    expect(minHunt).toBeLessThan(0.05) // real darkness
  })

  it('dying torch dims the light', () => {
    resetFlashlight()
    updateFlashlight(1 / 60, 30, 'patrol', 0) // far → intensity ~1
    const healthy = flashlightState.intensity
    flashlightState.dyingUntil = 10_000
    updateFlashlight(1 / 60, 30, 'patrol', 0) // now < dyingUntil
    expect(flashlightState.intensity).toBeLessThan(healthy)
  })
})

describe('observation gate', () => {
  const grid = openGrid(12, 12)
  const cam = new PerspectiveCamera(72, 1, 0.05, 200)
  const entity = new Vector3(cellCenterX(5), 0, cellCenterZ(2))

  const aim = (yaw: number) => {
    cam.position.set(cellCenterX(5), 1.6, cellCenterZ(5))
    cam.rotation.set(0, yaw, 0, 'YXZ')
    cam.updateMatrixWorld(true)
    cam.updateProjectionMatrix()
  }

  it('sees a lit entity in front with clear LOS', () => {
    aim(0) // looking down -Z, toward lower z where the entity is
    updateObservation(cam, grid, entity, 1)
    expect(observationState.entityInSight).toBe(true)
  })

  it('does not see the entity when facing away', () => {
    aim(Math.PI) // looking +Z, entity behind
    updateObservation(cam, grid, entity, 1)
    expect(observationState.entityInSight).toBe(false)
  })

  it('does not see through a wall', () => {
    const walled = openGrid(12, 12)
    setFloor(walled, 5, 3, false) // solid cell between camera (5,5) and entity (5,2)
    aim(0)
    updateObservation(cam, walled, entity, 1)
    expect(observationState.entityInSight).toBe(false)
  })

  it('does not see an unlit entity (flashlight off)', () => {
    aim(0)
    updateObservation(cam, grid, entity, 0) // no flashlight → only sub-threshold ambient
    expect(observationState.entityInSight).toBe(false)
  })
})

describe('quantum lock', () => {
  it('moves when unobserved and freezes when observed', () => {
    const grid = openGrid(14, 14)
    resetEntityState(new Vector3(cellCenterX(2), 0, cellCenterZ(2)))
    resetSenses()
    resetAI(1)
    setDebugAggression(4)
    const player = new Vector3(cellCenterX(7), 1.6, cellCenterZ(7)) // within sight range

    // A couple of free frames — it should close distance.
    const before = entityState.pos.clone()
    for (let i = 0; i < 5; i++) {
      updateSenses(0.1, grid, entityState.pos, player)
      updateEntity(0.1, false, grid, player, 4)
    }
    expect(senses.canSeePlayer).toBe(true)
    expect(entityState.pos.distanceTo(before)).toBeGreaterThan(0.1)

    // Now observed — it must not move at all.
    const frozen = entityState.pos.clone()
    for (let i = 0; i < 5; i++) {
      updateSenses(0.1, grid, entityState.pos, player)
      updateEntity(0.1, true, grid, player, 4)
    }
    expect(entityState.pos.distanceTo(frozen)).toBe(0)
  })
})

describe('post-escape flee grace', () => {
  it('cannot hunt or grab while fleeing, then resumes stalking when the timer expires', () => {
    const grid = openGrid(14, 14)
    resetEntityState(new Vector3(cellCenterX(7), 0, cellCenterZ(7)))
    resetSenses()
    resetAI(1)
    // Enter flee with a short grace timer; player stands on top of the entity (point-blank).
    entityState.state = 'flee'
    entityState.fleeTimer = 0.5
    const player = new Vector3(cellCenterX(7), 1.6, cellCenterZ(7))

    // Unobserved + point-blank at max aggression — it must NEVER grab or hunt while fleeing.
    for (let i = 0; i < 3; i++) {
      updateSenses(0.1, grid, entityState.pos, player)
      updateEntity(0.1, false, grid, player, 4)
      expect(entityState.state).toBe('flee')
    }

    // Timer elapses → drops back to stalk (grace over).
    updateSenses(0.1, grid, entityState.pos, player)
    updateEntity(0.3, false, grid, player, 4)
    expect(entityState.state).toBe('stalk')
  })
})

describe('debug freeze (aggression -1)', () => {
  it('holds the entity dead still and never grabs, even point-blank and unobserved', () => {
    const grid = openGrid(14, 14)
    resetEntityState(new Vector3(cellCenterX(7), 0, cellCenterZ(7)))
    resetSenses()
    resetAI(1)
    setDebugAggression(-1)
    const player = new Vector3(cellCenterX(7), 1.6, cellCenterZ(7)) // on top of it

    const before = entityState.pos.clone()
    for (let i = 0; i < 10; i++) {
      updateSenses(0.1, grid, entityState.pos, player)
      updateEntity(0.1, false, grid, player, 0)
      expect(entityState.state).not.toBe('grab')
    }
    expect(entityState.pos.distanceTo(before)).toBe(0)
    expect(entityState.frozen).toBe(true)

    setDebugAggression(0) // reset module state so other tests are unaffected
  })
})
