// blink.ts
// Manual blinking as a resource. Drain scales with strain: looking at the entity and
// being close both burn the meter faster, so backpedalling-and-staring is a losing race.
// Full blinks (voluntary short / forced long) refill the meter; involuntary micro-blinks
// below the threshold are warnings that do NOT refill — and every closed frame, micro
// included, is a frame the entity can move.

import { BLINK } from '../config/tuning'

export const blinkState = {
  meter: 1, // 1 = fully open/rested, 0 = empty
  blinking: false, // eyes closed this frame (full OR micro)
  forced: false, // the current full blink is the empty-meter punishment
}

let inFullBlink = false
let closedUntil = 0 // ms — end of the current full blink
let microUntil = 0 // ms — end of the current micro-flutter
let nextMicroAt = 0 // ms — when the next micro-flutter may fire

const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export function resetBlink(): void {
  blinkState.meter = 1
  blinkState.blinking = false
  blinkState.forced = false
  inFullBlink = false
  closedUntil = 0
  microUntil = 0
  nextMicroAt = 0
}

function startFullBlink(durationMs: number, forced: boolean, now: number): void {
  inFullBlink = true
  closedUntil = now + durationMs
  blinkState.blinking = true
  blinkState.forced = forced
}

/**
 * @param staring  entity currently in view + lit (observation.entityInSight)
 * @param closeness 0..1 proximity to the entity
 * @param pressed  the blink key went down this frame
 * @param now      performance.now() in ms
 */
export function updateBlink(dt: number, staring: boolean, closeness: number, pressed: boolean, now: number): void {
  // Still inside a full blink — stay closed.
  if (closedUntil > now) {
    blinkState.blinking = true
    return
  }
  // Just reopened from a full blink → refill. The eye opened this frame, so it doesn't
  // strain yet — skip the drain until next frame.
  if (inFullBlink) {
    inFullBlink = false
    blinkState.forced = false
    blinkState.meter = 1
    blinkState.blinking = false
    return
  }
  // Inside a micro-flutter — closed, but no drain and no refill.
  if (microUntil > now) {
    blinkState.blinking = true
    return
  }

  blinkState.blinking = false

  // Drain.
  const drain = BLINK.BASE * (staring ? BLINK.STARE_MULT : 1) * lerp(1, BLINK.PROX_MULT, clamp(closeness, 0, 1))
  blinkState.meter -= drain * dt

  // Voluntary blink (your choice) refills; empty meter forces a long punishment blink.
  if (pressed) {
    startFullBlink(BLINK.VOLUNTARY_MS, false, now)
    return
  }
  if (blinkState.meter <= 0) {
    blinkState.meter = 0
    startFullBlink(BLINK.FORCED_MS, true, now)
    return
  }

  // Below the threshold: involuntary micro-flutters, ramping in frequency as it empties.
  if (blinkState.meter < BLINK.MICRO_THRESHOLD && now >= nextMicroAt) {
    microUntil = now + BLINK.MICRO_MS
    const t = clamp(blinkState.meter / BLINK.MICRO_THRESHOLD, 0, 1)
    nextMicroAt = now + lerp(180, 900, t) // 900ms apart near the threshold → 180ms near empty
    blinkState.blinking = true
  }
}
