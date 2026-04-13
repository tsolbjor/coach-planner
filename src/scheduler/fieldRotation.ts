import type { Player, LineupSlot } from '../types'
import type { PlayerScore } from './types'

const MAX_CONSECUTIVE_BENCH = 2

/**
 * Given the keeper for this segment and the full player list,
 * selects which outfield players play and assigns them to lineup slots.
 * Returns: { assignments: slotId→playerId|null, bench: playerId[] }
 */
export function assignField(
  players: Player[],
  lineupSlots: LineupSlot[],
  keeperSlotId: string | null,
  keeperPlayerId: string | null,
  scores: Map<string, PlayerScore>,
  segmentIndex: number,
): { assignments: Record<string, string | null>; bench: string[] } {
  const outfieldSlots = lineupSlots.filter((s) => s.slotId !== keeperSlotId)
  const fieldCount = outfieldSlots.length

  // Candidates: everyone except the keeper this segment
  const candidates = players.filter((p) => p.id !== keeperPlayerId)

  // Sort by priority: most needs time → longest bench streak → deterministic tiebreak
  const sorted = [...candidates].sort((a, b) => {
    const sa = scores.get(a.id)!
    const sb = scores.get(b.id)!
    // Force players who've hit max consecutive bench to the front
    const aForced = sa.consecutiveBench >= MAX_CONSECUTIVE_BENCH ? 1 : 0
    const bForced = sb.consecutiveBench >= MAX_CONSECUTIVE_BENCH ? 1 : 0
    if (aForced !== bForced) return bForced - aForced
    // Fewest field minutes first
    if (sa.fieldMinutes !== sb.fieldMinutes) return sa.fieldMinutes - sb.fieldMinutes
    // Longest bench streak first
    if (sa.consecutiveBench !== sb.consecutiveBench) return sb.consecutiveBench - sa.consecutiveBench
    // Deterministic tiebreak using segment index + player id char code
    const aCode = a.id.charCodeAt(0) + segmentIndex
    const bCode = b.id.charCodeAt(0) + segmentIndex
    return aCode - bCode
  })

  const onField = sorted.slice(0, Math.min(fieldCount, sorted.length))
  const bench = sorted.slice(Math.min(fieldCount, sorted.length)).map((p) => p.id)

  // Assign positions within the on-field group
  const assignments: Record<string, string | null> = {}
  if (keeperSlotId !== null) {
    assignments[keeperSlotId] = keeperPlayerId
  }

  const unassignedSlots = [...outfieldSlots]
  const unassignedPlayers = [...onField]

  // Pass 1: assign players to their preferred positions
  for (const slot of [...unassignedSlots]) {
    const idx = unassignedPlayers.findIndex(
      (p) => p.preferredPositionTypeIds.includes(slot.positionTypeId),
    )
    if (idx !== -1) {
      assignments[slot.slotId] = unassignedPlayers[idx]!.id
      unassignedPlayers.splice(idx, 1)
      unassignedSlots.splice(unassignedSlots.indexOf(slot), 1)
    }
  }

  // Pass 2: fill remaining slots with remaining players in order
  for (let i = 0; i < unassignedSlots.length; i++) {
    const slot = unassignedSlots[i]!
    assignments[slot.slotId] = unassignedPlayers[i]?.id ?? null
  }

  return { assignments, bench }
}
