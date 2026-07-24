// tuning.ts
// SINGLE SOURCE OF TRUTH for every tuning constant. Each value carries its unit and,
// where it isn't obvious, the reason it is what it is. Systems import from here so a
// balance pass happens in one file.

import { MathUtils } from 'three'

// World scale: 1 unit = 1 metre.
export const WORLD = {
  CELL: 3, // m — corridor width / grid cell
  WALL_H: 3.5, // m
  EYE: 1.6, // m — standing eye height
  CROUCH_EYE: 1.0, // m
  PLAYER_R: 0.35, // m — collision radius
} as const

export const TIME = {
  MAX_DELTA: 1 / 30, // s — never integrate more than this in one frame (tab-restore spikes)
  MAX_STEP: 1 / 60, // s — substep size for integrators
} as const

// Movement. Entity at aggression 4 (6.5 m/s) outruns sprint (4.6) on purpose:
// you never outrun it, only outmanoeuvre via loops and corners.
export const MOVE = {
  walk: 2.5, // m/s
  crouch: 1.1, // m/s
  sprint: 4.6, // m/s
  BACKPEDAL: 0.55, // ×speed when moving backward — the physical twin of the strain drain
  STRAFE: 0.85, // ×speed on a pure strafe
  EYE_LERP: 10, // 1/s — eye-height damping rate (stand<->crouch)
} as const

export const LOOK = {
  SENSITIVITY: 0.0025, // rad per pixel of mouse movement
  PITCH_LIMIT: MathUtils.degToRad(85), // rad
} as const

// Noise emission radii by movement mode (metres). Artifact pickup is global.
export const NOISE = {
  walk: 8,
  crouch: 2,
  sprint: 25, // sprinting is a deliberate position-for-distance trade
  door: 12,
} as const

// Blink. Strain-scaled drain: staring at the entity and being close both burn faster,
// so backpedalling-and-staring is a losing race.
export const BLINK = {
  BASE: 0.04, // fraction/s (4%/s) → ~25s eyes-open when safe
  STARE_MULT: 2.5, // ×drain while the entity is in view + lit → ~10s
  PROX_MULT: 1.6, // ×drain at point-blank → ~6s staring & close
  VOLUNTARY_MS: 180, // your blink — short
  FORCED_MS: 500, // meter-empty punishment blink — long
  MICRO_MS: 40, // involuntary warning flutter below the threshold
  PROX_RANGE: 20, // m — closeness ramp for the proximity multiplier
  MICRO_THRESHOLD: 0.25, // meter fraction below which micro-blinks begin
} as const

// Flashlight flicker. Deterministic (layered incommensurable sines, no randomness) so
// it's identical on any framerate. Floor keeps it above the seen-threshold except in HUNT.
export const FLICKER = {
  RANGE: 20, // m — proximity ramp
  SINES: [11.3, 27.7, 43.1], // rad/s — deliberately not round, not commensurate
  WEIGHTS: [0.5, 0.3, 0.2],
  MAX_DEPTH: 0.9, // deepest dip at point-blank
  FLOOR: 0.35, // min intensity outside HUNT (stays above SEEN_THRESHOLD)
  SEEN_THRESHOLD: 0.25, // lightAt(entity) must exceed this to count as observed
  DYING_MS: 30000, // torch stays weak this long after a grab escape
  DYING_MUL: 0.3, // intensity multiplier at the depth of the dying window
} as const

// Flashlight — warm, and the thing that gates whether the entity can move. Widening
// CONE_DEG also widens the observation gate (they share it), which is consistent.
export const FLASHLIGHT = {
  BASE_INTENSITY: 160, // three SpotLight intensity at full (candela) — light on surfaces
  CONE_DEG: 34, // half-angle of the cone — wider throw
  RANGE: 24, // m — reach used by the light-gate falloff (lightAt)
  DISTANCE: 32, // m — SpotLight distance (longer throw)
  PENUMBRA: 0.55,
  AMBIENT: 0.05, // light-gate baseline (lightfield); MUST stay below FLICKER.SEEN_THRESHOLD.
  // NOTE: separate from the scene ambientLight (RENDER.AMBIENT) — this one feeds the gate.
} as const

// Visible volumetric light shaft — makes the cone glow in the air so open space isn't
// pure black. Alpha is flicker-linked (uIntensity = flashlightState.intensity).
export const BEAM = {
  LENGTH: 18, // m — visible haze length
  TIP_R: 0.06, // m — radius at the lamp
  OPACITY: 0.53, // haze strength (tuned live against the brighter torch/fill)
  ANGLE_DEG: 18, // half-angle of the VISIBLE shaft (narrower than the torch cone — a shaft, not a veil)
  APEX_FADE: 2.0, // m — ramp in over the first stretch so there's no bright disc in your face
  COLOR: '#ffe6c0',
} as const

// Cold, faint fill pinned to the camera so the floor at your feet and immediate walls are
// never pure black. Kept subtle so it doesn't reveal the (pale) entity outside the torch.
export const FILL = {
  INTENSITY: 2.7,
  DISTANCE: 7, // m
  COLOR: '#8a90b0',
} as const

// Emergency room lights — landmarks + pools of light, and they FEED the observation gate
// (a lit room is a "safe-ish zone"). Killed building-wide in the Act-3 blackout.
export const EMERGENCY = {
  COUNT: 12, // fixtures placed (subsample of level.rooms); capped for forward-render cost
  VISUAL_INTENSITY: 6.9, // three pointLight intensity (no shadows)
  VISUAL_DISTANCE: 9, // m
  COLOR: '#3ef07a', // sickly emergency green
  GATE_STRENGTH: 0.6, // light-gate contribution directly under a working fixture
  GATE_RANGE: 5, // m — gate contribution falls to 0 here
  DEAD_FRACTION: 0.15, // share of fixtures that are simply dead
  FLICKER_FRACTION: 0.5, // share that blink on/off
  BLINK: true, // blink on/off (vs a subtle shimmer)
  BLINK_RATE: 1.6, // blinks per second
} as const

// Entity appearance — a dark, see-through shape whose glowing red eyes are all that survive the
// fog at distance. Body opacity ramps to 0 with camera distance; eyes are emissive + fog-immune.
export const ENTITY = {
  BODY_COLOR: '#0a0a0c', // near-black → reads as a dark, see-through silhouette
  BODY_OPACITY: 0.35, // opacity at point-blank (see-through even up close)
  FADE_NEAR: 4, // m — full BODY_OPACITY within this range
  FADE_FAR: 16, // m — body fully gone beyond this (eyes only)
  EYE_COLOR: '#ff1414', // glowing red
  EYE_EMISSIVE: 3.2, // emissiveIntensity (toneMapped=false keeps it pure red)
  EYE_RADIUS: 0.045, // m
  EYE_X: 0.07, // m — half-separation, head half-width is 0.17
  EYE_Y: 2.08, // m — head height
  EYE_Z: -0.18, // m — head front; local −Z faces the player
} as const

export type EntityState = 'patrol' | 'investigate' | 'stalk' | 'hunt' | 'grab' | 'flee'

// Aggression scalar 0..4 (= artifacts collected) indexes every entity threshold.
// holdDist is the STALK stand-off — the death-spiral brake. At agg4 it's 0: hunts on sight.
export const AGGRO = {
  holdDist: [15, 12, 8, 4, 0], // m
  speed: [2.5, 3.2, 4.0, 5.0, 6.5], // m/s
  stalkToHunt: [Infinity, 45, 25, 12, 3], // s in STALK before committing to HUNT
  loseInterest: [20, 15, 10, 6, Infinity], // s without a knowledge refresh before giving up
  hearing: [10, 14, 18, 24, 40], // m — noise-hearing radius widens with aggression
  GRAB_DIST: 1.8, // m — contact range
  STRUGGLE_MS: 4000, // ms — struggle window on the one survivable grab
  POST_ESCAPE_FLEE_S: 6, // s — after an escape the entity flees and CANNOT hunt/grab (grace window)
  FLEE_SAMPLES: 24, // random floor cells sampled to pick the farthest flee target
} as const

// Audio occlusion by number of walls between listener and source.
// atten is linear gain; index 3 is used for 3+ walls.
export const AUDIO_OCCLUSION = [
  { atten: 1.0, lowpass: 22000 },
  { atten: 0.35, lowpass: 1200 }, // ~ -9 dB
  { atten: 0.12, lowpass: 500 }, // ~ -18 dB
  { atten: 0.0, lowpass: 200 }, // silent
] as const

// Level generation invariants.
export const GEN = {
  MACRO_W: 6, // room slots across the macro-grid
  MACRO_H: 6,
  STRIDE: 7, // cells between room-slot origins (room + corridor gutter)
  LOOP_RATIO_MIN: 0.18, // loops = survivability; a spanning tree is all coffins
  DEAD_END_MAX: 2, // cells — cap dead-end depth
  ARTIFACT_MIN_SEP: 25, // m
  ARTIFACT_COUNT: 5,
  REROLL_MAX: 50,
} as const

export const RENDER = {
  INTERNAL_W: 480,
  INTERNAL_H: 270,
  COLOR_BITS: 5, // posterize levels per channel
  FOG_DENSITY: 0.06, // eased so you can see a little further down corridors
  FOG_COLOR: '#08080b',
  VERTEX_SNAP: 160, // grid resolution for PSX vertex snapping
  AMBIENT: 0.14, // scene ambientLight intensity (visual only — NOT the light gate)
} as const

// Player spawn in world space (overwritten by the generator's spawn cell in M1+).
export const SPAWN = { x: 0, z: 0 } as const
