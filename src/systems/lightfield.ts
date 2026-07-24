// lightfield.ts
// How much light reaches a point. The flashlight the player SEES and the light the game
// TESTS for the observation gate are the same computation, so the flicker is honest —
// a dip that darkens the entity on screen is a dip that lets it move. Static/emergency
// lights get added here in later milestones.

import { MathUtils, Vector3 } from 'three'
import { FLASHLIGHT } from '../config/tuning'
import { staticLightAt } from './lights'

const CONE_COS = Math.cos(MathUtils.degToRad(FLASHLIGHT.CONE_DEG))
const _to = new Vector3()

/**
 * Light at `point` given the flashlight at `camPos` aimed along `camDir` (unit) with the
 * current flicker `flashIntensity`. Returns AMBIENT + cone contribution. LOS is assumed
 * to have been checked by the caller (observation only calls this for visible samples).
 */
export function lightAt(camPos: Vector3, camDir: Vector3, point: Vector3, flashIntensity: number): number {
  // Emergency fixtures contribute regardless of where you aim (they light the room), so a
  // lit room lets you freeze the entity without the torch.
  const stat = staticLightAt(point.x, point.z)

  _to.subVectors(point, camPos)
  const dist = _to.length()
  if (dist < 1e-4) return FLASHLIGHT.AMBIENT + flashIntensity + stat
  _to.divideScalar(dist)

  let flash = 0
  const cosA = _to.dot(camDir)
  if (cosA > CONE_COS) {
    const ang = (cosA - CONE_COS) / (1 - CONE_COS) // 0 at cone edge → 1 dead centre
    const distF = Math.max(0, 1 - dist / FLASHLIGHT.RANGE)
    flash = flashIntensity * ang * distF
  }
  return FLASHLIGHT.AMBIENT + flash + stat
}
