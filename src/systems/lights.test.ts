import { afterEach, describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { EMERGENCY, FLICKER } from '../config/tuning'
import { setCurrentLevel } from './level'
import { gameFlowState } from './gameFlow'
import { cellCenterX, cellCenterZ, makeGrid, setFloor, type Cell } from './nav/grid'
import { emergencyLights, resetEmergencyLights, staticLightAt, updateEmergencyLights } from './lights'
import { lightAt } from './lightfield'
import type { GeneratedLevel } from './generator/types'

function levelWithRooms(roomCount: number): GeneratedLevel {
  const grid = makeGrid(60, 60)
  for (let z = 0; z < 60; z++) for (let x = 0; x < 60; x++) setFloor(grid, x, z, true)
  const rooms: Cell[] = []
  for (let i = 0; i < roomCount; i++) rooms.push({ x: 3 + (i % 8) * 6, z: 3 + Math.floor(i / 8) * 6 })
  return { grid, spawn: { x: 1, z: 1 }, exit: { x: 58, z: 58 }, artifacts: [], rooms, seed: 7 }
}

afterEach(() => {
  gameFlowState.blackout = false
  emergencyLights.length = 0
})

describe('resetEmergencyLights', () => {
  it('places min(COUNT, rooms) fixtures at room centres', () => {
    setCurrentLevel(levelWithRooms(30))
    resetEmergencyLights(levelWithRooms(30), 7)
    expect(emergencyLights.length).toBe(EMERGENCY.COUNT)
    for (const l of emergencyLights) {
      expect(Number.isFinite(l.x)).toBe(true)
      expect(Number.isFinite(l.z)).toBe(true)
    }
  })

  it('is capped by the number of rooms', () => {
    setCurrentLevel(levelWithRooms(4))
    resetEmergencyLights(levelWithRooms(4), 7)
    expect(emergencyLights.length).toBe(4)
  })
})

describe('staticLightAt (light-gate contribution)', () => {
  it('exceeds the seen-threshold directly under a working fixture', () => {
    setCurrentLevel(levelWithRooms(1))
    emergencyLights.length = 0
    emergencyLights.push({ x: cellCenterX(10), z: cellCenterZ(10), cell: { x: 10, z: 10 }, dead: false, flickers: false, phase: 0, intensity: 1 })
    const v = staticLightAt(cellCenterX(10), cellCenterZ(10))
    expect(v).toBeGreaterThan(FLICKER.SEEN_THRESHOLD)
  })

  it('is zero beyond the gate range', () => {
    setCurrentLevel(levelWithRooms(1))
    emergencyLights.length = 0
    emergencyLights.push({ x: cellCenterX(10), z: cellCenterZ(10), cell: { x: 10, z: 10 }, dead: false, flickers: false, phase: 0, intensity: 1 })
    const far = cellCenterX(10) + EMERGENCY.GATE_RANGE + 1
    expect(staticLightAt(far, cellCenterZ(10))).toBe(0)
  })

  it('is zero for a dead fixture and during the Act-3 blackout', () => {
    setCurrentLevel(levelWithRooms(1))
    emergencyLights.length = 0
    emergencyLights.push({ x: cellCenterX(10), z: cellCenterZ(10), cell: { x: 10, z: 10 }, dead: false, flickers: false, phase: 0, intensity: 1 })

    gameFlowState.blackout = true
    updateEmergencyLights(0.016) // blackout kills it
    expect(staticLightAt(cellCenterX(10), cellCenterZ(10))).toBe(0)

    gameFlowState.blackout = false
    emergencyLights[0].dead = true
    updateEmergencyLights(0.016) // dead stays off
    expect(staticLightAt(cellCenterX(10), cellCenterZ(10))).toBe(0)
  })
})

describe('lightfield gate includes emergency lights', () => {
  it('an unlit entity under a working fixture still counts as lit (torch off)', () => {
    setCurrentLevel(levelWithRooms(1))
    emergencyLights.length = 0
    emergencyLights.push({ x: cellCenterX(10), z: cellCenterZ(10), cell: { x: 10, z: 10 }, dead: false, flickers: false, phase: 0, intensity: 1 })

    const cam = new Vector3(cellCenterX(20), 1.6, cellCenterZ(20)) // far away
    const dir = new Vector3(0, 0, -1)
    const entity = new Vector3(cellCenterX(10), 1.0, cellCenterZ(10))
    const light = lightAt(cam, dir, entity, 0) // flashlight OFF
    expect(light).toBeGreaterThan(FLICKER.SEEN_THRESHOLD)
  })
})
