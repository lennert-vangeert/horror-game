// useGame.ts
// Coarse game state only: phase machine, run identity, settings. Everything that
// changes per frame lives in module-scope system state, NOT here — this store should
// re-render React a handful of times per run, never inside the loop.

import { create } from 'zustand'

export type Phase = 'menu' | 'playing' | 'grabbed' | 'dead' | 'escaped'

export interface Settings {
  sfxVolume: number
  musicVolume: number
  sensitivity: number
  invertY: boolean
  headbob: boolean
}

const DEFAULT_SETTINGS: Settings = {
  sfxVolume: 0.8,
  musicVolume: 0.5,
  sensitivity: 0.0025,
  invertY: false,
  headbob: true,
}

const SETTINGS_KEY = 'hg_settings'

// Persist via JSON so we never hit the classic `localStorage.getItem() || false`
// trap where the string "false" reads as truthy.
function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) }
  } catch {
    /* corrupt or unavailable storage — fall back to defaults */
  }
  return { ...DEFAULT_SETTINGS }
}

interface GameStore {
  phase: Phase
  runId: number // incremented per run; used as a React key to remount the world
  seed: number
  artifactsHeld: number
  usedEscape: boolean // the one survivable grab has been spent
  paused: boolean
  settings: Settings

  startRun: (seed?: number) => void
  setPhase: (phase: Phase) => void
  setPaused: (paused: boolean) => void
  collectArtifact: () => void
  dropArtifact: () => void
  useEscape: () => void
  toMenu: () => void
  updateSettings: (patch: Partial<Settings>) => void
}

export const useGame = create<GameStore>((set, get) => ({
  phase: 'menu',
  runId: 0,
  seed: 0,
  artifactsHeld: 0,
  usedEscape: false,
  paused: false,
  settings: loadSettings(),

  startRun: (seed) => {
    const s = seed ?? (Math.floor(Math.random() * 0xffffffff) >>> 0)
    set({
      phase: 'playing',
      seed: s,
      runId: get().runId + 1,
      artifactsHeld: 0,
      usedEscape: false,
      paused: false,
    })
  },

  setPhase: (phase) => set({ phase }),
  setPaused: (paused) => set({ paused }),
  collectArtifact: () => set({ artifactsHeld: Math.min(5, get().artifactsHeld + 1) }),
  dropArtifact: () => set({ artifactsHeld: Math.max(0, get().artifactsHeld - 1) }),
  useEscape: () => set({ usedEscape: true }),
  toMenu: () => set({ phase: 'menu', paused: false }),

  updateSettings: (patch) => {
    const settings = { ...get().settings, ...patch }
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    } catch {
      /* ignore storage failures */
    }
    set({ settings })
  },
}))
