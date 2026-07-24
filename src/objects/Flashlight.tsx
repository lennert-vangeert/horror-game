import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  AdditiveBlending,
  Color,
  CylinderGeometry,
  DoubleSide,
  MathUtils,
  Mesh,
  Object3D,
  PointLight,
  ShaderMaterial,
  SpotLight,
  Vector3,
} from 'three'
import { BEAM, FILL, FLASHLIGHT } from '../config/tuning'
import { runtime } from '../config/runtime'
import { flashlightState } from '../systems/flashlight'

const _fwd = new Vector3()

// Volumetric beam: a cone of warm haze so open space isn't pure black. Because the torch is
// head-mounted (always viewed end-on), the classic side-glow model would be dim exactly when
// you look down your own beam — so density is driven by each fragment's ANGULAR distance from
// the beam axis (brightest at centre), faded with distance, and ramped in near the lamp.
// depthTest:true makes opaque walls (drawn first) occlude it correctly — no depth texture
// needed. Alpha is flicker-linked, so the beam pulses and blacks out with the torch.
const beamVertex = /* glsl */ `
  uniform float uLength;
  varying vec3 vWorld;
  varying float vAlong;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vAlong = clamp(-position.z / uLength, 0.0, 1.0); // 0 at the lamp → 1 at the far end
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

const beamFragment = /* glsl */ `
  precision highp float;
  uniform vec3 uCamPos;
  uniform vec3 uAxis;
  uniform vec3 uColor;
  uniform float uHalfAngle;
  uniform float uOpacity;
  uniform float uIntensity;
  uniform float uApexAlong;
  varying vec3 vWorld;
  varying float vAlong;
  void main() {
    float apex = smoothstep(0.0, uApexAlong, vAlong);   // no bright disc at the lamp
    float distFade = 1.0 - vAlong;                       // fade out toward the far end
    vec3 vd = normalize(vWorld - uCamPos);
    float ang = acos(clamp(dot(vd, uAxis), -1.0, 1.0));
    float radial = clamp(ang / uHalfAngle, 0.0, 1.0);    // 0 on axis → 1 at cone edge
    float radialFade = smoothstep(1.0, 0.0, radial);
    float alpha = uOpacity * uIntensity * apex * distFade * radialFade;
    gl_FragColor = vec4(uColor, alpha);
  }
`

export default function Flashlight() {
  const { camera } = useThree()
  const spot = useRef<SpotLight>(null)
  const fill = useRef<PointLight>(null)
  const beam = useRef<Mesh>(null)
  const target = useMemo(() => new Object3D(), [])

  const halfAngle = MathUtils.degToRad(FLASHLIGHT.CONE_DEG)

  const geometry = useMemo(() => {
    const farR = Math.tan(halfAngle) * BEAM.LENGTH
    const g = new CylinderGeometry(farR, BEAM.TIP_R, BEAM.LENGTH, 28, 1, true)
    g.translate(0, BEAM.LENGTH / 2, 0) // near end at y=0 (tip), far at y=LENGTH
    g.rotateX(-Math.PI / 2) // axis → local -Z, so mesh.quaternion = camera.quaternion aims it
    return g
  }, [halfAngle])

  const material = useMemo(() => {
    const m = new ShaderMaterial({
      uniforms: {
        uCamPos: { value: new Vector3() },
        uAxis: { value: new Vector3(0, 0, -1) },
        uColor: { value: new Color(BEAM.COLOR) },
        uHalfAngle: { value: halfAngle },
        uOpacity: { value: BEAM.OPACITY },
        uIntensity: { value: 1 },
        uApexAlong: { value: BEAM.APEX_FADE / BEAM.LENGTH },
        uLength: { value: BEAM.LENGTH },
      },
      vertexShader: beamVertex,
      fragmentShader: beamFragment,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: AdditiveBlending,
      side: DoubleSide,
    })
    m.userData.psxPatched = true // skip the vertex-snap patch — keep the beam smooth
    return m
  }, [halfAngle])

  useFrame(() => {
    const s = spot.current
    if (!s) return
    s.position.copy(camera.position)
    camera.getWorldDirection(_fwd)
    target.position.copy(camera.position).add(_fwd)
    s.target.updateMatrixWorld()
    s.intensity = runtime.torchIntensity * flashlightState.intensity

    if (fill.current) {
      fill.current.position.copy(camera.position)
      fill.current.intensity = runtime.fillIntensity
      fill.current.distance = runtime.fillDistance
    }

    if (beam.current) {
      beam.current.position.copy(camera.position)
      beam.current.quaternion.copy(camera.quaternion)
      const u = material.uniforms
      u.uCamPos.value.copy(camera.position)
      u.uAxis.value.copy(_fwd)
      u.uIntensity.value = flashlightState.intensity
      u.uOpacity.value = runtime.beamOpacity
      u.uHalfAngle.value = MathUtils.degToRad(runtime.beamAngleDeg)
      ;(u.uColor.value as Color).set(runtime.beamColor)
    }
  })

  return (
    <>
      <primitive object={target} />
      <spotLight
        ref={spot}
        target={target}
        angle={halfAngle}
        penumbra={FLASHLIGHT.PENUMBRA}
        distance={FLASHLIGHT.DISTANCE}
        decay={2}
        color="#ffe6c0"
        intensity={FLASHLIGHT.BASE_INTENSITY}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0005}
        shadow-camera-near={0.2}
        shadow-camera-far={FLASHLIGHT.DISTANCE}
      />
      {/* faint cold fill so the immediate area isn't pure black */}
      <pointLight ref={fill} intensity={FILL.INTENSITY} distance={FILL.DISTANCE} decay={2} color={FILL.COLOR} />
      {/* volumetric haze */}
      <mesh ref={beam} geometry={geometry} material={material} frustumCulled={false} renderOrder={2} />
    </>
  )
}
