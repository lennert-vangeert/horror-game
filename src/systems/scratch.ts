// scratch.ts
// Shared module-scope scratch objects, reused across systems to keep the per-frame
// path allocation-free. NEVER hold a reference to these across an await or a frame —
// treat them as borrowed for the duration of a single synchronous calculation.

import { Frustum, Matrix4, Ray, Vector2, Vector3 } from 'three'

export const v3a = new Vector3()
export const v3b = new Vector3()
export const v3c = new Vector3()
export const v3d = new Vector3()
export const v2a = new Vector2()
export const frustum = new Frustum()
export const mat4 = new Matrix4()
export const ray = new Ray()
