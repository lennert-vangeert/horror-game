import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Mesh, MeshStandardMaterial, PointLight } from 'three'
import { cellCenterX, cellCenterZ, type Cell } from '../systems/nav/grid'
import { gameFlowState } from '../systems/gameFlow'
import { WORLD } from '../config/tuning'

// The way out. Locked and dark until the 5th artifact unlocks it, then it glows green as
// a beacon for the escape run. Reads gameFlowState.exitUnlocked per-frame.
export default function Exit({ cell }: { cell: Cell }) {
  const door = useRef<Mesh>(null)
  const mat = useRef<MeshStandardMaterial>(null)
  const glow = useRef<PointLight>(null)

  useFrame((state) => {
    const unlocked = gameFlowState.exitUnlocked
    if (mat.current) {
      mat.current.emissiveIntensity = unlocked ? 1.4 + Math.sin(state.clock.elapsedTime * 3) * 0.3 : 0
    }
    if (glow.current) glow.current.intensity = unlocked ? 3 : 0
  })

  return (
    <group position={[cellCenterX(cell.x), 0, cellCenterZ(cell.z)]}>
      <mesh ref={door} position={[0, WORLD.WALL_H / 2, 0]}>
        <boxGeometry args={[1.4, WORLD.WALL_H - 0.2, 0.3]} />
        <meshStandardMaterial ref={mat} color="#243a24" emissive="#3bd45f" emissiveIntensity={0} roughness={0.7} />
      </mesh>
      <pointLight ref={glow} position={[0, 1.6, 0.5]} intensity={0} distance={7} decay={2} color="#5bff8a" />
    </group>
  )
}
