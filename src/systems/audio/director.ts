// audio/director.ts
// Turns simulation state into sound each frame. Heartbeat and breathing are the
// non-directional distance/strain cues. While the entity STALKS it is silent — instead
// the building telegraphs from its cell (occluded, a vague bearing). The instant it HUNTS
// it becomes loudly audible (the drone bed, minimal occlusion): the silence→noise flip is
// the headline scare, and it's fair — when it can kill you, you can hear where it is.

import { BLINK } from '../../config/tuning'
import { useGame } from '../../stores/useGame'
import { playerState } from '../player'
import { blinkState } from '../blink'
import { entityState } from '../entity/state'
import { currentLevel } from '../level'
import { cellCenterX, cellCenterZ, occlusionFor, wallsBetween, worldToCellX, worldToCellZ } from '../nav/grid'
import {
  audioReady,
  noiseBurst,
  setBusVolumes,
  startDrone,
  thump,
  tone,
  type DroneHandle,
} from './engine'

const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

const HEART_RANGE = 22 // m
let heartTimer = 0
let breathTimer = 0
let telegraphTimer = 4
let drone: DroneHandle | null = null

export function resetDirector(): void {
  heartTimer = 0
  breathTimer = 0
  telegraphTimer = 4
  drone?.stop()
  drone = null
}

/** Stereo pan (−1..1) + occlusion gain/lowpass for a source at world (sx,sz). */
function spatial(sx: number, sz: number): { gain: number; pan: number; lowpass: number } {
  const dx = sx - playerState.pos.x
  const dz = sz - playerState.pos.z
  const dist = Math.hypot(dx, dz) || 0.001
  const grid = currentLevel?.grid
  const walls = grid ? wallsBetween(grid, playerState.pos.x, playerState.pos.z, sx, sz) : 0
  const occ = occlusionFor(walls)
  const distGain = 1 / (1 + dist / 6)
  // Listener right vector from yaw (matches player.ts basis): (cos, -sin).
  const yaw = playerState.yaw
  const rx = Math.cos(yaw)
  const rz = -Math.sin(yaw)
  const pan = clamp((rx * dx + rz * dz) / dist, -1, 1)
  return { gain: distGain * occ.atten, pan, lowpass: occ.lowpass }
}

export function updateDirector(dt: number): void {
  if (!audioReady()) return
  const settings = useGame.getState().settings
  setBusVolumes(settings.sfxVolume, settings.sfxVolume * 0.9)

  const dist = entityState.distToPlayer
  const closeness = clamp(1 - dist / HEART_RANGE, 0, 1)

  // Heartbeat — always present, faster and louder the closer it is.
  heartTimer -= dt
  if (heartTimer <= 0) {
    const peak = lerp(0.05, 0.5, closeness)
    thump(58, peak, 0.16)
    // The 'dub' follows the 'lub'.
    setTimeout(() => thump(46, peak * 0.7, 0.14), 140)
    heartTimer = lerp(1.2, 0.34, closeness)
  }

  // Breathing — rate and rasp track the blink meter (the audio channel of the readout).
  breathTimer -= dt
  if (breathTimer <= 0) {
    const strain = 1 - blinkState.meter
    noiseBurst({
      peak: lerp(0.04, 0.14, strain),
      attack: 0.12,
      release: lerp(0.5, 0.28, strain),
      lowpass: lerp(900, 1600, strain),
      highpass: 300,
    })
    breathTimer = lerp(2.6, 1.05, strain)
    if (blinkState.meter < BLINK.MICRO_THRESHOLD) breathTimer *= 0.7
  }

  const state = entityState.state

  // HUNT bed — the entity becomes unmistakably audible.
  if (state === 'hunt' || state === 'grab') {
    if (!drone) drone = startDrone()
    const sp = spatial(entityState.pos.x, entityState.pos.z)
    // Minimal occlusion mercy in a hunt: keep it bright and present.
    drone?.setParams(lerp(0.05, 0.26, closeness), sp.pan, Math.max(sp.lowpass, 1400))
  } else if (drone) {
    drone.stop()
    drone = null
  }

  // STALK telegraph — the environment reacts from the entity's cell (occluded).
  if (state === 'stalk' || state === 'investigate') {
    telegraphTimer -= dt
    if (telegraphTimer <= 0) {
      playTelegraph()
      telegraphTimer = 3 + Math.random() * 4
    }
  } else {
    telegraphTimer = Math.min(telegraphTimer, 2)
  }
}

function playTelegraph(): void {
  const grid = currentLevel?.grid
  if (!grid) return
  const cx = worldToCellX(entityState.pos.x)
  const cz = worldToCellZ(entityState.pos.z)
  const sp = spatial(cellCenterX(cx), cellCenterZ(cz))
  if (sp.gain < 0.01) return // too far / too many walls to hear
  const kind = Math.random()
  if (kind < 0.4) {
    // structural groan
    noiseBurst({ peak: 0.3 * sp.gain, attack: 0.25, release: 1.1, lowpass: sp.lowpass * 0.6, pan: sp.pan })
  } else if (kind < 0.75) {
    // a shifting door / debris
    noiseBurst({ peak: 0.5 * sp.gain, attack: 0.005, release: 0.25, lowpass: sp.lowpass, highpass: 200, pan: sp.pan })
  } else {
    // ballast buzz
    tone({ type: 'square', from: 120, peak: 0.05 * sp.gain, dur: 0.4 })
  }
}

// --- one-shot stings (called from gameFlow) ---

export function stingPickup(): void {
  tone({ type: 'triangle', from: 660, to: 990, peak: 0.28, dur: 0.28, bus: 'sfx' })
}
export function stingUnlock(): void {
  thump(40, 0.6, 1.4, 'sfx')
  tone({ type: 'sawtooth', from: 110, to: 440, peak: 0.16, dur: 1.2, bus: 'sfx' })
}
export function stingBlackout(): void {
  thump(30, 0.7, 2.0, 'sfx')
}
export function stingGrab(): void {
  noiseBurst({ peak: 0.6, attack: 0.002, release: 0.5, lowpass: 4000, bus: 'sfx' })
  thump(70, 0.5, 0.4, 'sfx')
}
export function stingDeath(): void {
  tone({ type: 'sawtooth', from: 220, to: 40, peak: 0.4, dur: 1.6, bus: 'sfx' })
}
