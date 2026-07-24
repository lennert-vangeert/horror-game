// flashlight.ts
// Deterministic flicker (layered incommensurable sines — identical on any framerate, no
// randomness). A floor keeps the light above the seen-threshold everywhere EXCEPT when
// the entity is hunting, where dips punch through to true darkness and hand it free
// frames. So the flicker escalates from proximity-gauge to genuine threat exactly when
// the game turns lethal. Intensity drives both the visible SpotLight and lightAt().

import { FLICKER, type EntityState } from '../config/tuning'

export const flashlightState = {
  intensity: 1, // 0..~1.3 multiplier on the base light and the light-gate
  dyingUntil: 0, // ms — torch runs weak until here (after a grab escape)
}

let clock = 0

const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b)

export function resetFlashlight(): void {
  flashlightState.intensity = 1
  flashlightState.dyingUntil = 0
  clock = 0
}

/** Called on a grab escape: the torch limps for FLICKER.DYING_MS. */
export function startDyingTorch(now: number): void {
  flashlightState.dyingUntil = now + FLICKER.DYING_MS
}

export function updateFlashlight(dt: number, distToEntity: number, state: EntityState, now: number): void {
  clock += dt

  const prox = 1 - clamp(distToEntity / FLICKER.RANGE, 0, 1)
  const [f1, f2, f3] = FLICKER.SINES
  const [w1, w2, w3] = FLICKER.WEIGHTS
  const f = Math.sin(clock * f1) * w1 + Math.sin(clock * f2) * w2 + Math.sin(clock * f3) * w3 // ~[-1, 1]

  const hunting = state === 'hunt'
  // In HUNT, deepen the dip and drop the floor so real blackouts occur near the player.
  const depth = hunting ? Math.min(1.25, prox * prox * FLICKER.MAX_DEPTH * 1.4) : prox * prox * FLICKER.MAX_DEPTH
  const floor = hunting ? 0 : FLICKER.FLOOR

  let intensity = clamp(1 - f * depth, floor, 1.3)
  if (now < flashlightState.dyingUntil) intensity *= FLICKER.DYING_MUL

  flashlightState.intensity = intensity
}
