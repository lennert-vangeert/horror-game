// cameraShake.ts
// Trauma-based shake. Displacement is trauma² so small knocks fall off fast and only real
// events read as a jolt. Offset sines run at incommensurable rates — cheap, and unlike
// Math.random() it's framerate-independent. Written from events, read every frame.

import { Vector3 } from 'three'

const MAX_OFFSET = 0.16 // m — first-person, so keep it modest
const DECAY = 3.2 // per second
const FREQ = 43 // rad/s — deliberately not round

let trauma = 0
let clock = 0

export function addShake(amount: number): void {
  trauma = Math.min(trauma + amount, 1)
}

export function resetShake(): void {
  trauma = 0
  clock = 0
}

/** Displaces `pos` in place by the current shake. Call after the camera position is set. */
export function applyShake(dt: number, pos: Vector3): void {
  clock += dt
  trauma = Math.max(trauma - DECAY * dt, 0)
  const s = trauma * trauma
  if (s < 0.0002) return
  const a = s * MAX_OFFSET
  pos.x += Math.sin(clock * FREQ) * a
  pos.y += Math.sin(clock * FREQ * 1.37 + 1.7) * a
  pos.z += Math.sin(clock * FREQ * 0.83 + 3.1) * a
}
