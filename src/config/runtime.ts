// runtime.ts
// Live-tunable lighting values, initialized from the tuning constants. The per-frame render
// loops read from here instead of the constants, so the leva panel can change them instantly
// with no React re-render. In a production build the leva panel never mounts, so this object is
// never mutated and behaviour equals the tuning defaults.
//
// The explicit interface widens the fields (the tuning constants are `as const` literals, which
// would otherwise make each field un-reassignable).

import { BEAM, EMERGENCY, ENTITY, FILL, FLASHLIGHT, RENDER } from './tuning'

interface RuntimeConfig {
  torchIntensity: number
  fillIntensity: number
  fillDistance: number
  beamOpacity: number
  beamAngleDeg: number
  beamColor: string
  ambient: number
  fogDensity: number
  emergencyColor: string
  emergencyIntensity: number
  emergencyGateStrength: number
  emergencyBlink: boolean
  emergencyBlinkRate: number
  entityBodyOpacity: number
  entityFadeFar: number
  entityEyeColor: string
  entityEyeEmissive: number
}

export const runtime: RuntimeConfig = {
  // flashlight
  torchIntensity: FLASHLIGHT.BASE_INTENSITY,
  fillIntensity: FILL.INTENSITY,
  fillDistance: FILL.DISTANCE,

  // volumetric beam
  beamOpacity: BEAM.OPACITY,
  beamAngleDeg: BEAM.ANGLE_DEG,
  beamColor: BEAM.COLOR,

  // scene
  ambient: RENDER.AMBIENT,
  fogDensity: RENDER.FOG_DENSITY,

  // emergency lights
  emergencyColor: EMERGENCY.COLOR,
  emergencyIntensity: EMERGENCY.VISUAL_INTENSITY,
  emergencyGateStrength: EMERGENCY.GATE_STRENGTH,
  emergencyBlink: EMERGENCY.BLINK,
  emergencyBlinkRate: EMERGENCY.BLINK_RATE,

  // entity — see-through body + glowing red eyes
  entityBodyOpacity: ENTITY.BODY_OPACITY,
  entityFadeFar: ENTITY.FADE_FAR,
  entityEyeColor: ENTITY.EYE_COLOR,
  entityEyeEmissive: ENTITY.EYE_EMISSIVE,
}
