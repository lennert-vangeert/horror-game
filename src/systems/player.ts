// player.ts
// First-person movement, hand-integrated (no physics engine). Module-scope state read
// by the camera each frame — never React state. Collision is injected so this stays
// decoupled from the level: in M0 there is none; from M1 a circle-vs-grid resolver is
// passed in.

import { Vector3 } from 'three'
import { LOOK, MOVE, WORLD } from '../config/tuning'
import { held, mouseDeltaX, mouseDeltaY, pressed } from './input'

export type PlayerMode = 'walk' | 'crouch' | 'sprint'

/** Resolves `pos` (a circle of `radius`) out of walls, in place. */
export type CollideFn = (pos: Vector3, radius: number) => void

export const playerState = {
  pos: new Vector3(0, WORLD.EYE, 0),
  yaw: 0, // rad, around +Y
  pitch: 0, // rad
  eyeHeight: WORLD.EYE,
  mode: 'walk' as PlayerMode,
  moving: false,
  speed: 0, // m/s this frame — read by head-bob / audio
  crouching: false,
}

const forward = new Vector3()
const right = new Vector3()
const move = new Vector3()

export function resetPlayer(x: number, z: number, yaw = 0) {
  playerState.pos.set(x, WORLD.EYE, z)
  playerState.yaw = yaw
  playerState.pitch = 0
  playerState.eyeHeight = WORLD.EYE
  playerState.mode = 'walk'
  playerState.moving = false
  playerState.speed = 0
  playerState.crouching = false
}

export interface PlayerParams {
  sensitivity: number
  invertY: boolean
  collide?: CollideFn
}

export function updatePlayer(dt: number, params: PlayerParams) {
  // --- Look ---
  const sens = params.sensitivity || LOOK.SENSITIVITY
  playerState.yaw -= mouseDeltaX() * sens
  playerState.pitch -= mouseDeltaY() * sens * (params.invertY ? -1 : 1)
  if (playerState.pitch > LOOK.PITCH_LIMIT) playerState.pitch = LOOK.PITCH_LIMIT
  else if (playerState.pitch < -LOOK.PITCH_LIMIT) playerState.pitch = -LOOK.PITCH_LIMIT

  // --- Crouch (toggle) ---
  if (pressed('crouch')) playerState.crouching = !playerState.crouching

  // --- Movement input (physical axes) ---
  const f = (held('forward') ? 1 : 0) - (held('back') ? 1 : 0)
  const s = (held('right') ? 1 : 0) - (held('left') ? 1 : 0)

  let mode: PlayerMode = 'walk'
  if (playerState.crouching) mode = 'crouch'
  else if (held('sprint') && f > 0) mode = 'sprint'
  playerState.mode = mode

  let speed = MOVE[mode]
  if (f < 0) speed *= MOVE.BACKPEDAL // retreating costs ground
  else if (s !== 0 && f === 0) speed *= MOVE.STRAFE

  // Basis from yaw. At yaw 0 the player looks down -Z (three's default forward).
  const yaw = playerState.yaw
  forward.set(-Math.sin(yaw), 0, -Math.cos(yaw))
  right.set(Math.cos(yaw), 0, -Math.sin(yaw))
  move.set(0, 0, 0).addScaledVector(forward, f).addScaledVector(right, s)
  if (move.lengthSq() > 1) move.normalize()

  playerState.moving = f !== 0 || s !== 0
  playerState.speed = playerState.moving ? speed : 0

  playerState.pos.x += move.x * speed * dt
  playerState.pos.z += move.z * speed * dt

  if (params.collide) params.collide(playerState.pos, WORLD.PLAYER_R)

  // --- Eye height (crouch <-> stand), framerate-independent damping ---
  const targetEye = playerState.crouching ? WORLD.CROUCH_EYE : WORLD.EYE
  const k = 1 - Math.exp(-MOVE.EYE_LERP * dt)
  playerState.eyeHeight += (targetEye - playerState.eyeHeight) * k
  playerState.pos.y = playerState.eyeHeight
}
