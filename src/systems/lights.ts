// lights.ts
// Emergency room lights. They serve three jobs: landmarks in the dark, pools of light that
// break up the black of open space, and — crucially — they feed the observation gate
// (staticLightAt), so a lit room is a "safe-ish zone" where the entity can be frozen without
// the torch. All of them die building-wide in the Act-3 blackout. Module-scope sim state,
// same pattern as every other system.

import { EMERGENCY } from '../config/tuning'
import { runtime } from '../config/runtime'
import { makeRng } from './rng'
import { cellCenterX, cellCenterZ, wallsBetween, type Cell } from './nav/grid'
import { currentLevel } from './level'
import { gameFlowState } from './gameFlow'
import type { GeneratedLevel } from './generator/types'

export interface EmergencyLight {
  x: number // world position of the fixture
  z: number
  cell: Cell
  dead: boolean // simply doesn't work
  flickers: boolean // struggling fluorescent
  phase: number // per-light flicker offset
  intensity: number // current 0..1, written each frame
}

export const emergencyLights: EmergencyLight[] = []
let clock = 0

const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b)

export function resetEmergencyLights(level: GeneratedLevel, seed: number): void {
  emergencyLights.length = 0
  clock = 0
  const rng = makeRng((seed ^ 0x1b56c4f9) >>> 0)
  const rooms = rng.shuffle(level.rooms.slice())
  const n = Math.min(EMERGENCY.COUNT, rooms.length)
  for (let i = 0; i < n; i++) {
    const c = rooms[i]
    emergencyLights.push({
      x: cellCenterX(c.x),
      z: cellCenterZ(c.z),
      cell: { x: c.x, z: c.z },
      dead: rng.float() < EMERGENCY.DEAD_FRACTION,
      flickers: rng.float() < EMERGENCY.FLICKER_FRACTION,
      phase: rng.float() * 100,
      intensity: 0,
    })
  }
}

export function updateEmergencyLights(dt: number): void {
  clock += dt
  const blackout = gameFlowState.blackout
  for (const light of emergencyLights) {
    if (blackout || light.dead) {
      light.intensity = 0
      continue
    }
    if (light.flickers) {
      if (runtime.emergencyBlink) {
        // Clean on/off blink at the tunable rate, per-light phase offset.
        const cycle = (clock * runtime.emergencyBlinkRate + light.phase) % 1
        light.intensity = cycle < 0.6 ? 1 : 0.04 // 60% on, 40% off
      } else {
        // Struggling-fluorescent shimmer: mostly on with brief dropouts (layered sines).
        const t = clock + light.phase
        const n = Math.sin(t * 8.3) * 0.6 + Math.sin(t * 19.7) * 0.4 // ~[-1, 1]
        light.intensity = n > -0.6 ? 0.8 + 0.2 * Math.sin(t * 41.0) : 0.12
      }
    } else {
      light.intensity = 1
    }
  }
}

/**
 * Light-gate contribution at world (x, z) from working emergency fixtures with clear LOS.
 * Added to lightfield.lightAt so an entity under a lit fixture counts as observed.
 */
export function staticLightAt(x: number, z: number): number {
  const level: GeneratedLevel | null = currentLevel
  if (!level) return 0
  let sum = 0
  for (const light of emergencyLights) {
    if (light.intensity <= 0.05) continue
    const d = Math.hypot(light.x - x, light.z - z)
    if (d >= EMERGENCY.GATE_RANGE) continue
    if (wallsBetween(level.grid, light.x, light.z, x, z) !== 0) continue
    sum += runtime.emergencyGateStrength * (1 - d / EMERGENCY.GATE_RANGE) * clamp(light.intensity, 0, 1)
  }
  return sum
}
