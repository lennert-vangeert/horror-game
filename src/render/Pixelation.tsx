import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  Mesh,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Vector2,
  WebGLRenderTarget,
} from 'three'
import { RENDER } from '../config/tuning'
import { applyPsxToScene } from './psxMaterial'

// Manual render pipeline for the PSX look: render the scene into a fixed-height low-res
// target, then upscale nearest-neighbour to the screen through a shader that posterizes to
// ~5-bit colour with a 4×4 Bayer dither. A useFrame with priority > 0 takes over rendering
// for the whole app (r3f stops auto-rendering), so this MUST run every frame.
//
// Bonus: rendering at ~480×270 makes the shadowed torch spotlight ~9× cheaper than native.

const fragment = /* glsl */ `
  precision highp float;
  uniform sampler2D tDiffuse;
  uniform vec2 uResolution;
  uniform float uLevels;
  varying vec2 vUv;

  // Compact ordered-dither: 2×2 nested into 4×4. 16 distinct thresholds.
  float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
  float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }

  void main() {
    vec3 c = texture2D(tDiffuse, vUv).rgb;
    vec2 pix = vUv * uResolution;
    float d = (bayer4(pix) - 0.5) / uLevels;
    c += d;
    c = floor(c * uLevels + 0.5) / uLevels;
    gl_FragColor = vec4(c, 1.0);
  }
`

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

export default function Pixelation() {
  const { gl, scene, camera, size } = useThree()

  const rt = useMemo(() => {
    const target = new WebGLRenderTarget(RENDER.INTERNAL_W, RENDER.INTERNAL_H, {
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      generateMipmaps: false,
      depthBuffer: true,
      stencilBuffer: false,
    })
    target.texture.colorSpace = SRGBColorSpace
    return target
  }, [])

  const { fsScene, fsCamera, material } = useMemo(() => {
    const mat = new ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        uResolution: { value: new Vector2(RENDER.INTERNAL_W, RENDER.INTERNAL_H) },
        uLevels: { value: Math.pow(2, RENDER.COLOR_BITS) },
      },
      vertexShader: vertex,
      fragmentShader: fragment,
      depthTest: false,
      depthWrite: false,
    })
    const s = new Scene()
    const quad = new Mesh(new PlaneGeometry(2, 2), mat)
    quad.frustumCulled = false
    s.add(quad)
    return { fsScene: s, fsCamera: new OrthographicCamera(-1, 1, 1, -1, 0, 1), material: mat }
  }, [])

  // Keep square pixels: fix the height, derive width from the window aspect.
  useEffect(() => {
    const h = RENDER.INTERNAL_H
    const w = Math.max(1, Math.round(h * (size.width / size.height)))
    rt.setSize(w, h)
    material.uniforms.uResolution.value.set(w, h)
  }, [size, rt, material])

  // Vertex-snap every material once the world has mounted.
  useEffect(() => {
    applyPsxToScene(scene, RENDER.VERTEX_SNAP)
  }, [scene])

  useFrame(() => {
    gl.setRenderTarget(rt)
    gl.render(scene, camera)
    gl.setRenderTarget(null)
    material.uniforms.tDiffuse.value = rt.texture
    gl.render(fsScene, fsCamera)
  }, 1)

  return null
}
