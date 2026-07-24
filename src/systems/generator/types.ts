import type { Cell, Grid } from '../nav/grid'

export type ChunkTag = 'sightline' | 'room' | 'loop' | 'junction' | 'alcove' | 'atrium'

// A hand-authored room template. `rows` are top-down: '.' = floor, '#' = solid.
// The generator stamps these into the grid and always forces the slot's centre cell to
// floor so corridors can hook onto it regardless of the interior pattern.
export interface Chunk {
  name: string
  tags: ChunkTag[]
  rows: string[]
}

export interface GeneratedLevel {
  grid: Grid
  spawn: Cell
  exit: Cell
  artifacts: Cell[]
  rooms: Cell[] // room-slot centre cells
  seed: number
}
