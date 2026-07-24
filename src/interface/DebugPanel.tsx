import { Leva, button, useControls } from 'leva'
import { runtime } from '../config/runtime'
import { debugUI } from '../config/debug'
import { debugTeleportInFront, setDebugAggression } from '../systems/entity/ai'
import { debugCollectAll, debugToggleBlackout } from '../systems/gameFlow'

// Dev-only leva panel. Each control writes straight into the mutable `runtime` config (or
// calls an existing debug fn) via onChange, so the per-frame render loops pick it up with no
// React re-render. Lazy-loaded from App behind the DEBUG gate, so leva stays out of prod.
export default function DebugPanel() {
  useControls('lighting', {
    torch: { value: runtime.torchIntensity, min: 0, max: 160, step: 1, onChange: (v: number) => (runtime.torchIntensity = v) },
    fill: { value: runtime.fillIntensity, min: 0, max: 3, step: 0.05, onChange: (v: number) => (runtime.fillIntensity = v) },
    beamOpacity: { value: runtime.beamOpacity, min: 0, max: 0.6, step: 0.01, onChange: (v: number) => (runtime.beamOpacity = v) },
    beamAngle: { value: runtime.beamAngleDeg, min: 4, max: 40, step: 1, onChange: (v: number) => (runtime.beamAngleDeg = v) },
    beamColor: { value: runtime.beamColor, onChange: (v: string) => (runtime.beamColor = v) },
    ambient: { value: runtime.ambient, min: 0, max: 0.6, step: 0.01, onChange: (v: number) => (runtime.ambient = v) },
    fog: { value: runtime.fogDensity, min: 0, max: 0.2, step: 0.005, onChange: (v: number) => (runtime.fogDensity = v) },
  })

  useControls('emergency', {
    color: { value: runtime.emergencyColor, onChange: (v: string) => (runtime.emergencyColor = v) },
    intensity: { value: runtime.emergencyIntensity, min: 0, max: 8, step: 0.1, onChange: (v: number) => (runtime.emergencyIntensity = v) },
    gate: { value: runtime.emergencyGateStrength, min: 0, max: 1.5, step: 0.05, onChange: (v: number) => (runtime.emergencyGateStrength = v) },
    blink: { value: runtime.emergencyBlink, onChange: (v: boolean) => (runtime.emergencyBlink = v) },
    blinkRate: { value: runtime.emergencyBlinkRate, min: 0.2, max: 6, step: 0.1, onChange: (v: number) => (runtime.emergencyBlinkRate = v) },
  })

  useControls('entity', {
    bodyOpacity: { value: runtime.entityBodyOpacity, min: 0, max: 1, step: 0.01, onChange: (v: number) => (runtime.entityBodyOpacity = v) },
    fadeFar: { value: runtime.entityFadeFar, min: 6, max: 40, step: 1, onChange: (v: number) => (runtime.entityFadeFar = v) },
    eyeColor: { value: runtime.entityEyeColor, onChange: (v: string) => (runtime.entityEyeColor = v) },
    eyeGlow: { value: runtime.entityEyeEmissive, min: 0, max: 8, step: 0.1, onChange: (v: number) => (runtime.entityEyeEmissive = v) },
  })

  useControls('debug', {
    aggression: { value: 0, min: -1, max: 4, step: 1, onChange: (v: number) => setDebugAggression(v) }, // -1 = freeze
    teleportInFront: button(() => debugTeleportInFront()),
    collectAll: button(() => debugCollectAll()),
    blackout: button(() => debugToggleBlackout()),
    floodlight: { value: debugUI.floodlight, onChange: (v: boolean) => (debugUI.floodlight = v) },
    showMap: { value: debugUI.showMap, onChange: (v: boolean) => (debugUI.showMap = v) },
  })

  return <Leva collapsed />
}
