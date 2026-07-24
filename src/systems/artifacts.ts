// artifacts.ts
// Which of the level's 5 artifacts have been collected. Positions come from the level
// (currentLevel.artifacts); this only tracks state, mutated in place and read per-frame
// by the renderer and gameFlow — no React re-render on pickup.

export const artifactsState = {
  collected: [] as boolean[],
}

export function resetArtifacts(count: number): void {
  artifactsState.collected = new Array(count).fill(false)
}

export function collectedCount(): number {
  let n = 0
  for (const c of artifactsState.collected) if (c) n++
  return n
}
