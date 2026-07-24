// noise.ts
// Player-made sound reaching the entity. If a noise event lands within the entity's
// hearing radius (which widens with aggression) OR within the event's own loudness
// radius, the entity gains fresh knowledge of that location — and a patrolling entity
// escalates to investigating. Sprinting emits noise periodically; picking up an artifact
// emits a global (infinite-radius) event, so every acquisition aggros it from anywhere.

import { AGGRO } from '../config/tuning'
import { cellCenterX, cellCenterZ, type Cell } from './nav/grid'
import { entityState } from './entity/state'
import { noticeAt, senses } from './entity/senses'

export function emitNoise(cell: Cell, loudnessRadius: number, aggression: number): void {
  if (!entityState.active) return
  const wx = cellCenterX(cell.x)
  const wz = cellCenterZ(cell.z)
  const d = Math.hypot(wx - entityState.pos.x, wz - entityState.pos.z)
  const hearing = Math.max(AGGRO.hearing[aggression], loudnessRadius)
  if (d <= hearing) {
    noticeAt(cell)
    if (entityState.state === 'patrol') entityState.state = 'investigate'
    // Refresh the timer so a global pickup event re-commits an already-interested entity.
    senses.knowledgeAge = 0
  }
}
