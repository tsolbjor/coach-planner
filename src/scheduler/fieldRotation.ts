import type { Player, LineupSlot } from '../types'
import type { PlayerScore } from './types'

const MAX_CONSECUTIVE_BENCH = 1

/**
 * Given the keeper for this segment and the full player list,
 * selects which outfield players play and assigns them to lineup slots.
 *
 * Players staying on field keep their position until subbed out.
 * New players entering from the bench are assigned to open slots by eligibility.
 */
export function assignField(
  players: Player[],
  lineupSlots: LineupSlot[],
  keeperSlotId: string | null,
  keeperPlayerId: string | null,
  forcedBenchPlayerIds: string[],
  scores: Map<string, PlayerScore>,
  previousAssignments: Record<string, string | null> | null,
): { assignments: Record<string, string | null>; bench: string[] } {
  const outfieldSlots = lineupSlots.filter((s) => s.slotId !== keeperSlotId)
  const fieldCount = outfieldSlots.length
  const forcedBenchSet = new Set(forcedBenchPlayerIds)

  const canPlayPosition = (player: Player, positionTypeId: string) =>
    !(player.excludedPositionTypeIds ?? []).includes(positionTypeId)

  const candidates: Player[] = []
  const ineligibleBench: string[] = []
  for (const p of players) {
    if (p.id === keeperPlayerId || forcedBenchSet.has(p.id)) continue
    if (outfieldSlots.some((slot) => canPlayPosition(p, slot.positionTypeId))) {
      candidates.push(p)
    } else {
      ineligibleBench.push(p.id)
    }
  }

  // Sort by priority: most needs time → bench-fairness → deterministic tiebreak
  const sorted = [...candidates].sort((a, b) => {
    const sa = scores.get(a.id)!
    const sb = scores.get(b.id)!

    // 1. Force players who've hit max consecutive bench to the front (safety valve)
    const aForced = sa.consecutiveBench >= MAX_CONSECUTIVE_BENCH ? 1 : 0
    const bForced = sb.consecutiveBench >= MAX_CONSECUTIVE_BENCH ? 1 : 0
    if (aForced !== bForced) return bForced - aForced

    // 2. Sub the player on pitch the longest — maximises each player's unbroken run
    if (sa.consecutiveFieldSegments !== sb.consecutiveFieldSegments)
      return sa.consecutiveFieldSegments - sb.consecutiveFieldSegments

    // 3. Equalise total pitch time — keeper time counts the same as field time
    const totalA = sa.fieldMinutes + sa.keeperMinutes
    const totalB = sb.fieldMinutes + sb.keeperMinutes
    if (totalA !== totalB) return totalA - totalB

    // 4. Players with more bench stints get higher field priority (compensatory fairness)
    if (sa.benchSegments !== sb.benchSegments) return sb.benchSegments - sa.benchSegments

    // 5. FIFO: whoever was benched longest ago gets benched again first
    if (sa.lastBenchedSegment !== sb.lastBenchedSegment) return sb.lastBenchedSegment - sa.lastBenchedSegment

    // 6. Deterministic tiebreak
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })

  const onField = sorted.slice(0, Math.min(fieldCount, sorted.length))
  const bench = [
    ...forcedBenchPlayerIds,
    ...sorted.slice(Math.min(fieldCount, sorted.length)).map((p) => p.id),
    ...ineligibleBench,
  ]

  const assignments: Record<string, string | null> = {}
  if (keeperSlotId !== null) {
    assignments[keeperSlotId] = keeperPlayerId
  }

  const onFieldSet = new Set(onField.map((p) => p.id))
  const unassignedSlots = [...outfieldSlots]
  const unassignedPlayers = [...onField]

  // Pin continuing players: if a player was in this slot last segment and is still
  // on the field, keep them in the same position.
  for (const slot of [...unassignedSlots]) {
    const previousPlayerId = previousAssignments?.[slot.slotId] ?? null
    if (!previousPlayerId || previousPlayerId === keeperPlayerId) continue
    if (!onFieldSet.has(previousPlayerId)) continue

    const playerIndex = unassignedPlayers.findIndex((player) => (
      player.id === previousPlayerId && canPlayPosition(player, slot.positionTypeId)
    ))
    if (playerIndex === -1) continue

    assignments[slot.slotId] = previousPlayerId
    unassignedPlayers.splice(playerIndex, 1)
    unassignedSlots.splice(unassignedSlots.indexOf(slot), 1)
  }

  // Assign new players (from bench) to remaining slots by position eligibility
  for (const slot of [...unassignedSlots]) {
    const idx = unassignedPlayers.findIndex(
      (player) => canPlayPosition(player, slot.positionTypeId),
    )
    if (idx !== -1) {
      assignments[slot.slotId] = unassignedPlayers[idx]!.id
      unassignedPlayers.splice(idx, 1)
      unassignedSlots.splice(unassignedSlots.indexOf(slot), 1)
    }
  }

  // Mark remaining slots as empty (no eligible player available)
  for (const slot of unassignedSlots) {
    assignments[slot.slotId] = null
  }

  // Move any leftover players (ineligible for remaining slots) to bench
  for (const player of unassignedPlayers) {
    bench.push(player.id)
  }

  return { assignments, bench }
}
