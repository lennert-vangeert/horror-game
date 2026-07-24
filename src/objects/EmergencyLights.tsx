import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group, MeshStandardMaterial, PointLight } from 'three'
import { EMERGENCY, WORLD } from '../config/tuning'
import { runtime } from '../config/runtime'
import { emergencyLights } from '../systems/lights'

// Renders up to EMERGENCY.COUNT ceiling fixtures. Placement + on/off/flicker live in the
// sim (systems/lights.ts); this reads emergencyLights[i] every frame to set each fixture's
// position, visibility, and brightness — no React re-render, and no dependence on when the
// module array is populated (mirrors Artifacts.tsx). Point lights cast no shadows: the torch
// is the only shadow-caster, and these need to stay cheap.
const CEILING_Y = WORLD.WALL_H - 0.25
const SLOTS = Array.from({ length: EMERGENCY.COUNT }, (_, i) => i)

export default function EmergencyLights() {
  const groups = useRef<(Group | null)[]>([])
  const lights = useRef<(PointLight | null)[]>([])
  const mats = useRef<(MeshStandardMaterial | null)[]>([])

  useFrame(() => {
    for (let i = 0; i < SLOTS.length; i++) {
      const g = groups.current[i]
      if (!g) continue
      const data = emergencyLights[i]
      if (!data) {
        g.visible = false
        continue
      }
      g.visible = true
      g.position.set(data.x, CEILING_Y, data.z)
      const lit = data.intensity
      const pl = lights.current[i]
      if (pl) {
        pl.intensity = runtime.emergencyIntensity * lit
        pl.color.set(runtime.emergencyColor)
      }
      const m = mats.current[i]
      if (m) {
        m.emissiveIntensity = lit * 1.8 // scales straight from lit → dead/off fixtures go black
        m.emissive.set(runtime.emergencyColor)
      }
    }
  })

  return (
    <>
      {SLOTS.map((i) => (
        <group key={i} ref={(el) => (groups.current[i] = el)} visible={false}>
          {/* fixture housing */}
          <mesh position={[0, 0.05, 0]}>
            <boxGeometry args={[0.5, 0.12, 0.5]} />
            <meshStandardMaterial
              ref={(el) => (mats.current[i] = el)}
              color="#2a2a26"
              emissive={EMERGENCY.COLOR}
              emissiveIntensity={0}
              toneMapped={false}
            />
          </mesh>
          {/* light pool below the fixture */}
          <pointLight
            ref={(el) => (lights.current[i] = el)}
            position={[0, -0.2, 0]}
            intensity={0}
            distance={EMERGENCY.VISUAL_DISTANCE}
            decay={2}
            color={EMERGENCY.COLOR}
          />
        </group>
      ))}
    </>
  )
}
