// rng.ts
// Seeded PRNG (mulberry32). A given seed reproduces a level and every "random" sim
// choice exactly — essential for debugging and seed-share replay. NEVER use Math.random
// in the simulation; draw from an Rng instead.

export interface Rng {
  float(): number // [0, 1)
  int(n: number): number // [0, n)
  range(min: number, max: number): number
  pick<T>(arr: readonly T[]): T
  chance(p: number): boolean
  shuffle<T>(arr: T[]): T[]
}

export function makeRng(seed: number): Rng {
  let a = seed >>> 0

  const float = (): number => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const int = (n: number) => Math.floor(float() * n)
  const range = (min: number, max: number) => min + float() * (max - min)
  const pick = <T>(arr: readonly T[]): T => arr[int(arr.length)]
  const chance = (p: number) => float() < p
  const shuffle = <T>(arr: T[]): T[] => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = int(i + 1)
      const tmp = arr[i]
      arr[i] = arr[j]
      arr[j] = tmp
    }
    return arr
  }

  return { float, int, range, pick, chance, shuffle }
}
