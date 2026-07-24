import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group, MeshStandardMaterial } from 'three'
import { entityState } from '../systems/entity/state'
import { ENTITY } from '../config/tuning'
import { runtime } from '../config/runtime'

// The entity: a dark, see-through humanoid slab whose only reliable tell from a distance is a
// pair of glowing red eyes. No rig — the horror is a thing that plainly cannot walk yet keeps
// arriving closer. Tells are pure transform: HUNT leans in and stretches, frozen is dead still.
// The body's opacity ramps to 0 with camera distance (and FogExp2 finishes the job), while the
// eyes are emissive + fog-immune, so from afar you see only two red points in the black.
const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1)

export default function Entity() {
  const group = useRef<Group>(null)
  const bodyMat = useRef<MeshStandardMaterial>(null)
  const headMat = useRef<MeshStandardMaterial>(null)
  const eyeL = useRef<MeshStandardMaterial>(null)
  const eyeR = useRef<MeshStandardMaterial>(null)

  useFrame((state) => {
    const g = group.current
    if (!g) return
    g.position.set(entityState.pos.x, 0, entityState.pos.z)
    g.rotation.y = entityState.yaw

    const hunting = entityState.state === 'hunt' || entityState.state === 'grab'
    g.scale.y = hunting ? 1.04 : 1
    g.rotation.x = hunting ? -0.06 : 0 // lean toward the player

    // See-through body that fades out with distance so only the eyes read from afar.
    const dist = state.camera.position.distanceTo(g.position)
    const t = clamp01((dist - ENTITY.FADE_NEAR) / (runtime.entityFadeFar - ENTITY.FADE_NEAR))
    const op = runtime.entityBodyOpacity * (1 - t)
    if (bodyMat.current) bodyMat.current.opacity = op
    if (headMat.current) headMat.current.opacity = op

    // Eyes: live-tunable glow, punchier during the hunt.
    const glow = runtime.entityEyeEmissive * (hunting ? 1.5 : 1)
    if (eyeL.current) {
      eyeL.current.emissiveIntensity = glow
      eyeL.current.emissive.set(runtime.entityEyeColor)
    }
    if (eyeR.current) {
      eyeR.current.emissiveIntensity = glow
      eyeR.current.emissive.set(runtime.entityEyeColor)
    }
  })

  return (
    <group ref={group}>
      {/* body — dark, see-through; base at floor, ~2 m tall. No castShadow: a solid shadow from
          an "invisible" body would give it away. depthWrite off so it doesn't self-sort or punch
          the flashlight beam. */}
      <mesh position={[0, 1.0, 0]}>
        <boxGeometry args={[0.55, 2.0, 0.4]} />
        <meshStandardMaterial
          ref={bodyMat}
          color={ENTITY.BODY_COLOR}
          roughness={1}
          transparent
          opacity={ENTITY.BODY_OPACITY}
          depthWrite={false}
        />
      </mesh>
      {/* head */}
      <mesh position={[0, 2.05, 0.02]}>
        <boxGeometry args={[0.34, 0.34, 0.34]} />
        <meshStandardMaterial
          ref={headMat}
          color={ENTITY.BODY_COLOR}
          roughness={1}
          transparent
          opacity={ENTITY.BODY_OPACITY}
          depthWrite={false}
        />
      </mesh>
      {/* eyes — emissive red, fog-immune (fog=false) and untonemapped so they punch through the
          fog that swallows the body; opaque + default depthTest so walls still occlude them. */}
      <mesh position={[ENTITY.EYE_X, ENTITY.EYE_Y, ENTITY.EYE_Z]}>
        <sphereGeometry args={[ENTITY.EYE_RADIUS, 8, 8]} />
        <meshStandardMaterial
          ref={eyeL}
          color="#000000"
          emissive={ENTITY.EYE_COLOR}
          emissiveIntensity={ENTITY.EYE_EMISSIVE}
          toneMapped={false}
          fog={false}
        />
      </mesh>
      <mesh position={[-ENTITY.EYE_X, ENTITY.EYE_Y, ENTITY.EYE_Z]}>
        <sphereGeometry args={[ENTITY.EYE_RADIUS, 8, 8]} />
        <meshStandardMaterial
          ref={eyeR}
          color="#000000"
          emissive={ENTITY.EYE_COLOR}
          emissiveIntensity={ENTITY.EYE_EMISSIVE}
          toneMapped={false}
          fog={false}
        />
      </mesh>
    </group>
  )
}
