// observation.ts
// The heart of the mechanic: is the entity being observed? Four gates — in the camera
// frustum, clear line of sight, lit above the seen-threshold, and eyes open. This module
// computes the first three (entityInSight); the blink gate is applied by the caller after
// blink.update, which keeps the blink<->observation dependency acyclic.

import { Camera, Vector3 } from 'three'
import { FLICKER } from '../config/tuning'
import { frustum, mat4 } from './scratch'
import { hasLineOfSight, type Grid } from './nav/grid'
import { lightAt } from './lightfield'

export const observationState = {
  entityInSight: false, // frustum ∧ LOS ∧ lit — NOT gated on blink
  lightOnEntity: 0,
  dist: Infinity,
}

// Head / torso / feet, so partial cover behind a doorframe reads correctly.
const SAMPLE_Y = [1.8, 1.0, 0.15]
const _p = new Vector3()
const _dir = new Vector3()
const _centre = new Vector3()

export function updateObservation(camera: Camera, grid: Grid, entityPos: Vector3, flashIntensity: number): void {
  observationState.dist = camera.position.distanceTo(entityPos)

  mat4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
  frustum.setFromProjectionMatrix(mat4)
  camera.getWorldDirection(_dir)

  let seen = false
  for (const oy of SAMPLE_Y) {
    _p.set(entityPos.x, entityPos.y + oy, entityPos.z)
    if (!frustum.containsPoint(_p)) continue
    if (hasLineOfSight(grid, camera.position.x, camera.position.z, _p.x, _p.z)) {
      seen = true
      break
    }
  }

  _centre.set(entityPos.x, entityPos.y + 1.0, entityPos.z)
  const light = seen ? lightAt(camera.position, _dir, _centre, flashIntensity) : 0
  observationState.lightOnEntity = light
  observationState.entityInSight = seen && light >= FLICKER.SEEN_THRESHOLD
}

export function resetObservation(): void {
  observationState.entityInSight = false
  observationState.lightOnEntity = 0
  observationState.dist = Infinity
}
