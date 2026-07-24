import { type ReactElement } from 'react'
import { WORLD } from '../config/tuning'

// M0 stand-in scene so movement and look are testable before the generator exists.
// Replaced by objects/World.tsx (instanced tiles from the grid) in M1.
export default function PlaceholderWorld() {
  const pillars: ReactElement[] = []
  for (let x = -4; x <= 4; x++) {
    for (let z = -8; z <= 4; z++) {
      if ((((x % 3) + 3) % 3) === 0 && (((z % 3) + 3) % 3) === 0) {
        pillars.push(
          <mesh
            key={`${x}-${z}`}
            position={[x * 4, WORLD.WALL_H / 2, z * 4 - 12]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[1.2, WORLD.WALL_H, 1.2]} />
            <meshStandardMaterial color="#42424a" roughness={0.95} />
          </mesh>,
        )
      }
    }
  }

  return (
    <>
      <color attach="background" args={['#08080b']} />
      <fogExp2 attach="fog" args={['#08080b', 0.05]} />
      <ambientLight intensity={0.12} />
      <pointLight
        position={[0, 3.2, -8]}
        intensity={30}
        distance={26}
        decay={2}
        color="#ffd8a6"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#26262b" roughness={1} />
      </mesh>
      {pillars}
    </>
  )
}
