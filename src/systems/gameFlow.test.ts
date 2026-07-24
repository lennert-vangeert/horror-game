import { beforeEach, describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { useGame } from '../stores/useGame'
import { setCurrentLevel } from './level'
import { makeGrid, setFloor, type Cell } from './nav/grid'
import { artifactsState } from './artifacts'
import { entityState, resetEntityState } from './entity/state'
import { resetSenses } from './entity/senses'
import {
  beginGrab,
  debugCollectAll,
  gameFlowState,
  getGrabEscalation,
  resetGameFlow,
  updateGrab,
} from './gameFlow'
import type { GeneratedLevel } from './generator/types'

function tinyLevel(): GeneratedLevel {
  const grid = makeGrid(8, 8)
  for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) setFloor(grid, x, z, true)
  const artifacts: Cell[] = [
    { x: 1, z: 1 },
    { x: 6, z: 1 },
    { x: 1, z: 6 },
    { x: 6, z: 6 },
    { x: 3, z: 3 },
  ]
  return { grid, spawn: { x: 2, z: 2 }, exit: { x: 7, z: 7 }, artifacts, rooms: [], seed: 1 }
}

beforeEach(() => {
  setCurrentLevel(tinyLevel())
  useGame.getState().startRun(1)
  resetGameFlow()
  resetSenses()
  resetEntityState(new Vector3(6, 0, 6))
})

describe('gameFlow — grab / escape / death', () => {
  it('first grab is survivable and enters the grabbed phase', () => {
    beginGrab(0)
    expect(useGame.getState().phase).toBe('grabbed')
    expect(gameFlowState.grabbing).toBe(true)
  })

  it('a successful struggle escapes: drops an artifact, spends the escape, nets +1 aggression', () => {
    // Hold two artifacts.
    useGame.getState().collectArtifact()
    useGame.getState().collectArtifact()
    artifactsState.collected[0] = true
    artifactsState.collected[1] = true
    const heldBefore = useGame.getState().artifactsHeld

    beginGrab(0)
    gameFlowState.struggleProgress = 1 // filled the escape bar
    updateGrab(0.016, 100)

    const s = useGame.getState()
    expect(s.phase).toBe('playing')
    expect(s.usedEscape).toBe(true)
    expect(s.artifactsHeld).toBe(heldBefore - 1) // dropped one
    expect(getGrabEscalation()).toBe(2) // net +1 aggression after the −1 drop
    expect(artifactsState.collected.filter(Boolean).length).toBe(1) // one flipped back
  })

  it('escaping puts the entity into a timed flee (grace), not an instant re-stalk', () => {
    beginGrab(0)
    gameFlowState.struggleProgress = 1
    updateGrab(0.016, 100)
    expect(entityState.state).toBe('flee')
    expect(entityState.fleeTimer).toBeGreaterThan(0)
  })

  it('a failed struggle (time out) is death', () => {
    beginGrab(0)
    gameFlowState.struggleProgress = 0.2
    updateGrab(0.016, 999_999) // well past grabEndsAt
    expect(useGame.getState().phase).toBe('dead')
  })

  it('any grab after the escape is instant death', () => {
    beginGrab(0)
    gameFlowState.struggleProgress = 1
    updateGrab(0.016, 100) // escape → usedEscape

    beginGrab(200) // second contact
    expect(useGame.getState().phase).toBe('dead')
  })
})

describe('gameFlow — acts', () => {
  it('collecting all five unlocks the exit and fails the lights', () => {
    expect(gameFlowState.exitUnlocked).toBe(false)
    expect(gameFlowState.blackout).toBe(false)
    debugCollectAll()
    expect(useGame.getState().artifactsHeld).toBe(5)
    expect(gameFlowState.exitUnlocked).toBe(true)
    expect(gameFlowState.blackout).toBe(true)
  })
})
