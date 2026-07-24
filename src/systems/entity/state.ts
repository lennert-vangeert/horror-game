// entity/state.ts
// Module-scope entity state, written by ai.ts and read by the renderer, flashlight,
// observation and audio. Never React state.

import { Vector3 } from 'three'
import type { EntityState } from '../../config/tuning'
import type { Cell } from '../nav/grid'

export const entityState = {
  pos: new Vector3(), // floor position (y = 0)
  yaw: 0, // faces the player
  state: 'patrol' as EntityState,
  aggression: 0,
  frozen: false, // observed this frame (quantum lock engaged)
  distToPlayer: Infinity,

  path: null as Cell[] | null,
  pathIndex: 0,
  targetCell: null as Cell | null,

  stalkTimer: 0,
  repathTimer: 0,
  fleeTimer: 0, // s of post-escape flee/grace remaining; while > 0 it can't hunt or grab
  active: false,
}

export function resetEntityState(pos: Vector3): void {
  entityState.pos.copy(pos)
  entityState.yaw = 0
  entityState.state = 'patrol'
  entityState.aggression = 0
  entityState.frozen = false
  entityState.distToPlayer = Infinity
  entityState.path = null
  entityState.pathIndex = 0
  entityState.targetCell = null
  entityState.stalkTimer = 0
  entityState.repathTimer = 0
  entityState.fleeTimer = 0
  entityState.active = true
}
