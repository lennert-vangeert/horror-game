// gameFlow.ts
// The run: three acts, artifact pickups, the one survivable grab, and win/lose. Aggression
// is artifactsHeld + grab-escalation (an escape nets +1 aggression even though it costs you
// an artifact). Collecting the 5th unlocks the exit and fails the building's lights —
// same level, different game — and the escape run begins.

import { AGGRO, NOISE } from '../config/tuning'
import { useGame } from '../stores/useGame'
import { pressed, held } from './input'
import { playerState } from './player'
import { currentLevel } from './level'
import { artifactsState, resetArtifacts } from './artifacts'
import { emitNoise } from './noise'
import { entityState } from './entity/state'
import { senses } from './entity/senses'
import { startDyingTorch } from './flashlight'
import { stingBlackout, stingDeath, stingGrab, stingPickup, stingUnlock } from './audio/director'
import { cellCenterX, cellCenterZ, isFloor, worldToCellX, worldToCellZ, type Cell } from './nav/grid'

const PICKUP_RANGE = 2.6 // m
const PICKUP_HOLD_S = 2.5 // s to collect
const EXIT_RANGE = 3.0 // m
const STRUGGLE_GAIN = 0.11 // per Space press
const STRUGGLE_DECAY = 0.42 // per second
const SPRINT_NOISE_INTERVAL = 0.3 // s
const ESCAPE_PUSHBACK = 6 // m the entity is shoved back on a successful escape

export const gameFlowState = {
  grabbing: false,
  struggleProgress: 0, // 0..1
  grabEndsAt: 0,
  blackout: false, // Act-3 building-wide light failure
  exitUnlocked: false,
  interactProgress: 0, // 0..1, hold-to-collect
  nearestArtifact: -1,
  nearExit: false,
}

let grabEscalation = 0
let sprintNoiseTimer = 0

export function resetGameFlow(): void {
  gameFlowState.grabbing = false
  gameFlowState.struggleProgress = 0
  gameFlowState.grabEndsAt = 0
  gameFlowState.blackout = false
  gameFlowState.exitUnlocked = false
  gameFlowState.interactProgress = 0
  gameFlowState.nearestArtifact = -1
  gameFlowState.nearExit = false
  grabEscalation = 0
  sprintNoiseTimer = 0
  resetArtifacts(currentLevel?.artifacts.length ?? 5)
}

export function getGrabEscalation(): number {
  return grabEscalation
}

/** Called by the entity AI on contact. First grab is survivable; any later one is fatal. */
export function beginGrab(now: number): void {
  const store = useGame.getState()
  if (store.usedEscape) {
    stingDeath()
    store.setPhase('dead')
    return
  }
  gameFlowState.grabbing = true
  gameFlowState.struggleProgress = 0
  gameFlowState.grabEndsAt = now + AGGRO.STRUGGLE_MS
  stingGrab()
  store.setPhase('grabbed')
}

/** Runs only while phase === 'grabbed'. Mash Space to fill the escape bar before time runs out. */
export function updateGrab(dt: number, now: number): void {
  if (!gameFlowState.grabbing) return
  if (pressed('blink')) gameFlowState.struggleProgress += STRUGGLE_GAIN

  // A filled bar breaks free this frame — check before decay so it can't be shaved back.
  if (gameFlowState.struggleProgress >= 1) {
    escape(now)
    return
  }
  gameFlowState.struggleProgress = Math.max(0, gameFlowState.struggleProgress - STRUGGLE_DECAY * dt)

  if (now >= gameFlowState.grabEndsAt) {
    gameFlowState.grabbing = false
    stingDeath()
    useGame.getState().setPhase('dead')
  }
}

function escape(now: number): void {
  const store = useGame.getState()
  gameFlowState.grabbing = false
  gameFlowState.struggleProgress = 0

  // Cost: drop an artifact, torch dies, aggression nets +1.
  const lastHeld = artifactsState.collected.lastIndexOf(true)
  if (lastHeld >= 0) artifactsState.collected[lastHeld] = false
  store.dropArtifact()
  grabEscalation += 2 // net +1 after the −1 drop
  store.useEscape()
  startDyingTorch(now)

  // Entity flees for a grace window (can't hunt/grab) rather than instantly re-grabbing.
  pushEntityBack()
  entityState.state = 'flee'
  entityState.fleeTimer = AGGRO.POST_ESCAPE_FLEE_S
  entityState.stalkTimer = 0
  entityState.targetCell = null // flee picks a fresh far target immediately
  senses.knowledgeAge = 999

  store.setPhase('playing')
}

function pushEntityBack(): void {
  const grid = currentLevel?.grid
  if (!grid) return
  let dx = entityState.pos.x - playerState.pos.x
  let dz = entityState.pos.z - playerState.pos.z
  const len = Math.hypot(dx, dz) || 1
  dx /= len
  dz /= len
  const tx = entityState.pos.x + dx * ESCAPE_PUSHBACK
  const tz = entityState.pos.z + dz * ESCAPE_PUSHBACK
  if (isFloor(grid, worldToCellX(tx), worldToCellZ(tz))) {
    entityState.pos.x = tx
    entityState.pos.z = tz
    entityState.path = null
  }
}

/** Runs each frame while playing: pickups, sprint noise, exit check. */
export function updateGameFlow(dt: number, aggression: number): void {
  const level = currentLevel
  if (!level) return
  const store = useGame.getState()
  const px = playerState.pos.x
  const pz = playerState.pos.z
  const playerCell: Cell = { x: worldToCellX(px), z: worldToCellZ(pz) }

  // --- nearest uncollected artifact within reach ---
  let nearest = -1
  let nearestD = PICKUP_RANGE
  for (let i = 0; i < level.artifacts.length; i++) {
    if (artifactsState.collected[i]) continue
    const a = level.artifacts[i]
    const d = Math.hypot(cellCenterX(a.x) - px, cellCenterZ(a.z) - pz)
    if (d < nearestD) {
      nearestD = d
      nearest = i
    }
  }
  gameFlowState.nearestArtifact = nearest

  // --- hold to collect ---
  if (nearest >= 0 && held('interact')) {
    gameFlowState.interactProgress += dt / PICKUP_HOLD_S
    if (gameFlowState.interactProgress >= 1) collect(nearest, playerCell, aggression)
  } else {
    gameFlowState.interactProgress = Math.max(0, gameFlowState.interactProgress - dt / PICKUP_HOLD_S)
  }

  // --- sprint is loud ---
  if (playerState.mode === 'sprint' && playerState.moving) {
    sprintNoiseTimer -= dt
    if (sprintNoiseTimer <= 0) {
      emitNoise(playerCell, NOISE.sprint, aggression)
      sprintNoiseTimer = SPRINT_NOISE_INTERVAL
    }
  }

  // --- exit ---
  if (gameFlowState.exitUnlocked) {
    const d = Math.hypot(cellCenterX(level.exit.x) - px, cellCenterZ(level.exit.z) - pz)
    gameFlowState.nearExit = d < EXIT_RANGE * 2
    if (d < EXIT_RANGE) store.setPhase('escaped')
  }
}

function collect(index: number, playerCell: Cell, aggression: number): void {
  const store = useGame.getState()
  artifactsState.collected[index] = true
  store.collectArtifact()
  gameFlowState.interactProgress = 0
  stingPickup()

  // Loud, global — aggros the entity from anywhere on the map.
  emitNoise(playerCell, Infinity, aggression)

  if (store.artifactsHeld >= WORLD_ARTIFACTS) unlockExit()
}

const WORLD_ARTIFACTS = 5

function unlockExit(): void {
  gameFlowState.exitUnlocked = true
  gameFlowState.blackout = true // building-wide light failure — the escape run begins
  stingUnlock()
  stingBlackout()
}

/** Dev/test helper: toggle the Act-3 building-wide blackout (kills ambient + emergency lights). */
export function debugToggleBlackout(): void {
  gameFlowState.blackout = !gameFlowState.blackout
}

/** Dev/test helper: collect every artifact and unlock the exit (jump to the escape run). */
export function debugCollectAll(): void {
  const level = currentLevel
  if (!level) return
  const store = useGame.getState()
  for (let i = 0; i < level.artifacts.length; i++) {
    if (!artifactsState.collected[i]) {
      artifactsState.collected[i] = true
      store.collectArtifact()
    }
  }
  unlockExit()
}
