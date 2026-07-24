import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { AmbientLight, Vector3 } from 'three'
import { useGame } from './stores/useGame'
import { endInputFrame, installInput, pointerLockLost, pressed, resetLockWatch, uninstallInput } from './systems/input'
import { type CollideFn, playerState, resetPlayer, updatePlayer } from './systems/player'
import { BLINK, RENDER, TIME } from './config/tuning'
import { runtime } from './config/runtime'
import { debugUI } from './config/debug'
import { generateLevel } from './systems/generator/generate'
import { setCurrentLevel } from './systems/level'
import { resetEmergencyLights, updateEmergencyLights } from './systems/lights'
import { buildCollider, cellCenterX, cellCenterZ } from './systems/nav/grid'
import { v3a } from './systems/scratch'
import { flashlightState, resetFlashlight, updateFlashlight } from './systems/flashlight'
import { blinkState, resetBlink, updateBlink } from './systems/blink'
import { observationState, resetObservation, updateObservation } from './systems/observation'
import { entityState, resetEntityState } from './systems/entity/state'
import { resetSenses, updateSenses } from './systems/entity/senses'
import { getDebugAggression, resetAI, setOnGrab, updateEntity } from './systems/entity/ai'
import {
  beginGrab,
  gameFlowState,
  getGrabEscalation,
  resetGameFlow,
  updateGameFlow,
  updateGrab,
} from './systems/gameFlow'
import { resetDirector, updateDirector } from './systems/audio/director'
import { addShake, applyShake, resetShake } from './systems/cameraShake'
import World from './objects/World'
import Entity from './objects/Entity'
import Flashlight from './objects/Flashlight'
import Artifacts from './objects/Artifacts'
import Exit from './objects/Exit'
import EmergencyLights from './objects/EmergencyLights'
import Pixelation from './render/Pixelation'
import type { EntityState } from './config/tuning'

const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b)
const DEBUG_FLOOD = 10 // ambient intensity when the debug floodlight is on

export default function Game() {
  const runId = useGame((s) => s.runId)
  const seed = useGame((s) => s.seed)
  const { camera, gl } = useThree()

  const level = useMemo(() => generateLevel(seed), [seed])
  const collideRef = useRef<CollideFn | null>(null)
  const ambientRef = useRef<AmbientLight>(null)
  const prevEntityState = useRef<EntityState>('patrol')

  useEffect(() => {
    installInput(gl.domElement)
    return () => uninstallInput()
  }, [gl])

  // Per-run reset of every module-scope system.
  useEffect(() => {
    setCurrentLevel(level)
    collideRef.current = buildCollider(level.grid)
    resetPlayer(cellCenterX(level.spawn.x), cellCenterZ(level.spawn.z), -Math.PI * 0.75)
    resetFlashlight()
    resetBlink()
    resetObservation()
    resetSenses()
    resetEntityState(new Vector3(cellCenterX(level.exit.x), 0, cellCenterZ(level.exit.z)))
    resetAI(level.seed)
    resetGameFlow()
    resetEmergencyLights(level, level.seed)
    resetDirector()
    resetShake()
    prevEntityState.current = 'patrol'
    resetLockWatch()
    setOnGrab(() => beginGrab(performance.now()))
    return () => {
      setOnGrab(null)
      resetDirector()
      setCurrentLevel(null)
    }
  }, [level, runId])

  useFrame((_, deltaRaw) => {
    const dt = Math.min(deltaRaw, TIME.MAX_DELTA)
    const store = useGame.getState()
    const now = performance.now()
    const grid = level.grid

    if (ambientRef.current) {
      ambientRef.current.intensity = debugUI.floodlight
        ? DEBUG_FLOOD
        : gameFlowState.blackout
          ? 0.0
          : runtime.ambient
    }

    // --- Grab sequence: player frozen, the thing in your face, mash to break free. ---
    if (store.phase === 'grabbed') {
      updateGrab(dt, now)
      updateEmergencyLights(dt)
      updateDirector(dt)
      camera.getWorldDirection(v3a)
      entityState.pos.set(camera.position.x + v3a.x * 1.3, 0, camera.position.z + v3a.z * 1.3)
      entityState.yaw = Math.atan2(v3a.x, v3a.z)
      // Thrash: keep topping trauma from the frozen player position so it can't drift.
      camera.position.copy(playerState.pos)
      addShake(0.3)
      applyShake(dt, camera.position)
      endInputFrame()
      return
    }

    if (store.phase !== 'playing') {
      endInputFrame()
      return
    }

    // Pause on Esc, or when pointer lock is lost after having been acquired (alt-tab).
    if (!store.paused && (pressed('pause') || pointerLockLost())) {
      store.setPaused(true)
    }
    if (store.paused) {
      endInputFrame()
      return
    }

    const aggression = clamp(store.artifactsHeld + getGrabEscalation() + Math.max(0, getDebugAggression()), 0, 4)

    // 1. Player → camera.
    updatePlayer(dt, {
      sensitivity: store.settings.sensitivity,
      invertY: store.settings.invertY,
      collide: collideRef.current ?? undefined,
    })
    camera.position.copy(playerState.pos)
    camera.rotation.set(playerState.pitch, playerState.yaw, 0, 'YXZ')
    applyShake(dt, camera.position)

    // 2. Geometry to the threat.
    const dist = camera.position.distanceTo(entityState.pos)
    const closeness = 1 - clamp(dist / BLINK.PROX_RANGE, 0, 1)

    // 3. Flashlight flicker + emergency-light flicker/blackout (both feed the light gate).
    updateFlashlight(dt, dist, entityState.state, now)
    updateEmergencyLights(dt)

    // 4. Observation: frustum ∧ LOS ∧ lit → entityInSight (blink applied after).
    updateObservation(camera, grid, entityState.pos, flashlightState.intensity)

    // 5. Blink: strain from staring at the lit entity + proximity.
    updateBlink(dt, observationState.entityInSight, closeness, pressed('blink'), now)

    // 6. Full observation gate = in sight AND eyes open.
    const isObserved = observationState.entityInSight && !blinkState.blinking

    // 7. Entity senses + AI (quantum-locked: moves only while unobserved).
    updateSenses(dt, grid, entityState.pos, playerState.pos)
    updateEntity(dt, isObserved, grid, playerState.pos, aggression)

    // A jolt the moment it commits to the hunt.
    if (entityState.state === 'hunt' && prevEntityState.current !== 'hunt') addShake(0.6)
    prevEntityState.current = entityState.state

    // 8. Run logic: pickups, sprint noise, exit, act transitions.
    updateGameFlow(dt, aggression)

    // 9. Audio: heartbeat, breathing, telegraph, hunt bed.
    updateDirector(dt)

    endInputFrame()
  })

  return (
    <group key={runId}>
      <ambientLight ref={ambientRef} intensity={RENDER.AMBIENT} />
      <World grid={level.grid} />
      <Flashlight />
      <EmergencyLights />
      <Artifacts cells={level.artifacts} />
      <Exit cell={level.exit} />
      <Entity />
      <Pixelation />
    </group>
  )
}
