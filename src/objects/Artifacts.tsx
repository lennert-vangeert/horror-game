import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group } from 'three'
import { cellCenterX, cellCenterZ, type Cell } from '../systems/nav/grid'
import { artifactsState } from '../systems/artifacts'

// The 5 artifacts. Emissive so the torch (and their own faint glow) makes them findable —
// the light gate is about the entity, not these. Each hovers and spins; a collected one
// is hidden by toggling visibility per-frame (module state, no React re-render).
export default function Artifacts({ cells }: { cells: Cell[] }) {
  const groups = useRef<(Group | null)[]>([])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    for (let i = 0; i < cells.length; i++) {
      const g = groups.current[i]
      if (!g) continue
      const collected = artifactsState.collected[i] === true
      g.visible = !collected
      if (collected) continue
      g.position.y = 1.1 + Math.sin(t * 1.5 + i) * 0.12
      g.rotation.y = t * 0.8 + i
    }
  })

  return (
    <>
      {cells.map((c, i) => (
        <group key={i} ref={(el) => (groups.current[i] = el)} position={[cellCenterX(c.x), 1.1, cellCenterZ(c.z)]}>
          <mesh castShadow>
            <octahedronGeometry args={[0.28, 0]} />
            <meshStandardMaterial
              color="#ffd27a"
              emissive="#ffb43a"
              emissiveIntensity={1.6}
              roughness={0.4}
              toneMapped={false}
            />
          </mesh>
          <pointLight intensity={1.2} distance={4} decay={2} color="#ffc766" />
        </group>
      ))}
    </>
  )
}
