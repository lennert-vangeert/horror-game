// chunks.ts
// Hand-authored room templates (max 6×6). This is where authored dread lives inside a
// procedural level: a sightline hall for first-sightings, pillar rooms that break line
// of sight (good escapes), tight alcoves for tension, open junctions. The generator
// picks, rotates, and connects them — infinite layouts, but every room was designed.
//
// '.' = floor, '#' = solid. Rows are top-down (increasing z).

import type { Chunk } from './types'

export const CHUNKS: Chunk[] = [
  {
    name: 'open_room',
    tags: ['room'],
    rows: ['.....', '.....', '.....', '.....', '.....'],
  },
  {
    name: 'pillar_room', // breaks LOS — a good place to lose the entity
    tags: ['room', 'loop'],
    rows: ['.....', '.#.#.', '.....', '.#.#.', '.....'],
  },
  {
    name: 'long_hall', // sightline: where you first see it down a corridor
    tags: ['sightline'],
    rows: ['......', '......'],
  },
  {
    name: 'cross', // four-way junction
    tags: ['junction', 'loop'],
    rows: ['..#..', '..#..', '.....', '..#..', '..#..'],
  },
  {
    name: 'alcoves', // tight, high tension
    tags: ['alcove'],
    rows: ['#...#', '.....', '#...#', '.....', '#...#'],
  },
  {
    name: 'atrium', // large open room, multiple exits
    tags: ['room', 'atrium'],
    rows: ['......', '......', '......', '......', '......', '......'],
  },
  {
    name: 't_room',
    tags: ['junction'],
    rows: ['.....', '.....', '..#..', '..#..'],
  },
  {
    name: 'switchback',
    tags: ['loop'],
    rows: ['....#', '.###.', '.....', '.###.', '#....'],
  },
  {
    name: 'small_chamber',
    tags: ['room', 'alcove'],
    rows: ['...', '...', '...'],
  },
  {
    name: 'colonnade',
    tags: ['sightline', 'room'],
    rows: ['.#.#.#', '......', '.#.#.#'],
  },
]

/** Rotate a rows grid clockwise by 90°·turns. Used to vary chunk orientation per seed. */
export function rotateRows(rows: string[], turns: number): string[] {
  let out = rows
  const n = ((turns % 4) + 4) % 4
  for (let t = 0; t < n; t++) out = rotateOnce(out)
  return out
}

function rotateOnce(rows: string[]): string[] {
  const h = rows.length
  const w = rows[0].length
  const res: string[] = []
  for (let x = 0; x < w; x++) {
    let row = ''
    for (let z = h - 1; z >= 0; z--) row += rows[z][x]
    res.push(row)
  }
  return res
}
