import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { FogExp2, InstancedMesh, Matrix4 } from 'three'
import { RENDER, WORLD } from '../config/tuning'
import { runtime } from '../config/runtime'
import { cellCenterX, cellCenterZ, isFloor, type Grid } from '../systems/nav/grid'

const { CELL, WALL_H } = { CELL: WORLD.CELL, WALL_H: WORLD.WALL_H }

// Builds instance transforms once from the grid: a floor + ceiling per walkable cell,
// and a full-height block per solid cell that borders at least one floor cell (interior
// solids are never seen, so they're skipped). Solid cells ARE the walls.
function buildInstances(grid: Grid) {
  const floors: Matrix4[] = []
  const ceils: Matrix4[] = []
  const walls: Matrix4[] = []
  const m = new Matrix4()

  for (let z = 0; z < grid.h; z++) {
    for (let x = 0; x < grid.w; x++) {
      const wx = cellCenterX(x)
      const wz = cellCenterZ(z)
      if (isFloor(grid, x, z)) {
        floors.push(new Matrix4().copy(m.makeTranslation(wx, -0.05, wz)))
        ceils.push(new Matrix4().copy(m.makeTranslation(wx, WALL_H, wz)))
      } else {
        const bordersFloor =
          isFloor(grid, x + 1, z) ||
          isFloor(grid, x - 1, z) ||
          isFloor(grid, x, z + 1) ||
          isFloor(grid, x, z - 1) ||
          isFloor(grid, x + 1, z + 1) ||
          isFloor(grid, x - 1, z + 1) ||
          isFloor(grid, x + 1, z - 1) ||
          isFloor(grid, x - 1, z - 1)
        if (bordersFloor) walls.push(new Matrix4().copy(m.makeTranslation(wx, WALL_H / 2, wz)))
      }
    }
  }
  return { floors, ceils, walls }
}

function Tiles({
  matrices,
  size,
  color,
  cast = false,
  receive = false,
}: {
  matrices: Matrix4[]
  size: [number, number, number]
  color: string
  cast?: boolean
  receive?: boolean
}) {
  const ref = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    for (let i = 0; i < matrices.length; i++) mesh.setMatrixAt(i, matrices[i])
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [matrices])

  if (matrices.length === 0) return null
  return (
    <instancedMesh
      ref={ref}
      args={[null!, null!, matrices.length]}
      castShadow={cast}
      receiveShadow={receive}
      frustumCulled={false}
    >
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={1} />
    </instancedMesh>
  )
}

export default function World({ grid }: { grid: Grid }) {
  const { floors, ceils, walls } = useMemo(() => buildInstances(grid), [grid])
  const fogRef = useRef<FogExp2>(null)

  // Live-tunable fog density (the JSX arg is only the initial value).
  useFrame(() => {
    if (fogRef.current) fogRef.current.density = runtime.fogDensity
  })

  return (
    <>
      <color attach="background" args={[RENDER.FOG_COLOR]} />
      <fogExp2 ref={fogRef} attach="fog" args={[RENDER.FOG_COLOR, RENDER.FOG_DENSITY]} />
      {/* ambient lives in Game so the Act-3 blackout can kill it */}
      <Tiles matrices={floors} size={[CELL, 0.1, CELL]} color="#232327" receive />
      <Tiles matrices={ceils} size={[CELL, 0.1, CELL]} color="#141417" />
      <Tiles matrices={walls} size={[CELL, WALL_H, CELL]} color="#3a3a42" cast receive />
    </>
  )
}
