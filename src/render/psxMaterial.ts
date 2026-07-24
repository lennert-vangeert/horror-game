// psxMaterial.ts
// Vertex snapping — the PSX wobble. Patches every material in the scene via
// onBeforeCompile so projected vertices snap to a coarse grid (the affine/jitter look).
// The low-res target + dither carry most of the aesthetic; this adds the characteristic
// vertex swim. (True affine-perspective UV isn't available in WebGL2 GLSL ES 3.00, so we
// don't attempt it — the snap is the readable part anyway.)

import type { Object3D } from 'three'

interface Patchable {
  userData: Record<string, unknown>
  onBeforeCompile?: (shader: { vertexShader: string; uniforms: Record<string, { value: unknown }> }) => void
  needsUpdate?: boolean
}

function patch(mat: Patchable, snap: number): void {
  if (mat.userData.psxPatched) return
  mat.userData.psxPatched = true
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSnap = { value: snap }
    shader.vertexShader =
      'uniform float uSnap;\n' +
      shader.vertexShader.replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        {
          vec4 snapped = gl_Position;
          snapped.xyz /= snapped.w;
          snapped.xy = floor(snapped.xy * uSnap) / uSnap;
          snapped.xyz *= snapped.w;
          gl_Position = snapped;
        }`,
      )
  }
  mat.needsUpdate = true
}

/** Patch every material currently in the scene. Safe to call repeatedly (idempotent). */
export function applyPsxToScene(scene: Object3D, snap: number): void {
  scene.traverse((obj: Object3D) => {
    const holder = obj as unknown as { material?: Patchable | Patchable[] }
    const mat = holder.material
    if (!mat) return
    if (Array.isArray(mat)) mat.forEach((m) => patch(m, snap))
    else patch(mat, snap)
  })
}
