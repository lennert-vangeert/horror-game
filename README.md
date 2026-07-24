# the building

A 3D browser horror game. You're trapped in a dark, procedurally-generated maze to collect
five artifacts while a **quantum-locked entity** stalks you: it freezes the instant it's
observed and moves fast the instant it isn't. It stalks before it kills, and grows more
aggressive with every artifact you take.

Built with React Three Fiber + TypeScript. No engine, no physics library, no audio assets —
the maze, the AI, the lighting, and all sound are generated in code.

## The mechanics

- **Observation gate.** The entity is frozen only when it's in your view frustum, has clear
  line of sight, is **lit above a threshold**, and your eyes are open. Your weak flashlight
  is therefore load-bearing — and it flickers harder the closer the entity is, so every
  flicker is a frame it can move.
- **Blinking is a resource.** Hold `Space` to blink. The meter drains faster while you stare
  at the entity and faster still up close, so you can't out-stare it — only choose when to
  lose. Empty the meter and you blink involuntarily for far longer. The readout is fully
  diegetic: eyelids creep in, the world desaturates, micro-blinks warn you.
- **Aggression 0–4** (one per artifact) scales every threshold: hold distance, speed, how
  long it stalks before hunting. Collect the 5th and the exit unlocks, the lights fail
  building-wide, and it hunts on sight — the escape run.
- **One survivable grab.** First contact is a struggle (mash `Space`); escape and you drop an
  artifact, your torch dies, and aggression climbs. Any contact after that is fatal.
- **Sound is the other threat sense.** Heartbeat and breathing encode distance and strain.
  While stalking, the entity is silent — the building telegraphs from its cell (occluded by
  walls). The moment it hunts, it becomes loudly, unmistakably audible.

## Controls

`WASD` move · mouse look · `Space` blink · `Shift` sprint (loud — aggros it) · `C` crouch ·
`E` hold to take · `Esc` pause.

Dev only (dev build): `` ` `` debug map · `0`–`4` force aggression · `U` collect all ·
`T` turn (no pointer lock needed).

## Running

```bash
npm install
npm run dev        # vite dev server
npm run build      # tsc --noEmit && vite build → dist/
npm run test       # vitest (systems layer)
```

## Architecture

- **`src/systems/`** — pure TypeScript, no React. All per-frame simulation state lives in
  module scope and is driven once per frame, in a fixed order, from the single `useFrame` in
  `Game.tsx`. React only re-renders on phase transitions.
- **`src/objects/`** — R3F scene components; they compose the scene graph and read system
  state, never own logic.
- **`src/interface/`** — DOM overlay (HUD, menus), a sibling of the canvas. The HUD writes to
  refs via `addEffect` so it never re-renders during play.
- **`src/render/`** — the PSX pipeline: scene → low-res (~480×270) target → nearest upscale
  with posterize + Bayer dither, plus vertex-snapped materials.
- **`src/config/tuning.ts`** — every tuning constant, one file.

The level is a pure function of a seed: prefab room chunks placed on a macro-grid, woven with
corridors, loop-punched for survivability, then validated (reroll on failure). The same grid
serves geometry (instanced tiles), collision (circle-vs-grid), pathfinding (A*), and audio
occlusion (wall-count DDA).

## Status

Milestones M0–M6 are implemented and verified (build + 27 unit tests + browser smoke).
Deferred: multi-floor verticality (atrium/stairs chunks need cross-floor navigation), a
sculpted entity mesh + tile art, and an audio ear-tuning pass.
