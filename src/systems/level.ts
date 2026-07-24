// level.ts
// Holds the current generated level at module scope so any system (entity AI, audio,
// debug map) can read it without prop-drilling through the React tree. Set once per run
// by Game.tsx. Live binding: importers see updates.

import type { GeneratedLevel } from './generator/types'

export let currentLevel: GeneratedLevel | null = null

export function setCurrentLevel(level: GeneratedLevel | null): void {
  currentLevel = level
}
