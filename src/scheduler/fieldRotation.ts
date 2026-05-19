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
  slotOrderOffset = 0,
): { assignments: Record<string, string | null>; bench: string[] } {
  const outfieldSlots = lineupSlots.filter((s) => s.slotId !== keeperSlotId)
  const forcedBenchSet = new Set(forcedBenchPlayerIds)

  const canPlayPosition = (player: Player, positionTypeId: string) =>
    !(player.excludedPositionTypeIds ?? []).includes(positionTypeId)

  const candidates: Player[] = []
  const forcedCandidates: Player[] = []
  const ineligibleBench: string[] = []
  for (const p of players) {
    if (p.id === keeperPlayerId) continue
    if (outfieldSlots.some((slot) => canPlayPosition(p, slot.positionTypeId))) {
      if (forcedBenchSet.has(p.id)) forcedCandidates.push(p)
      else candidates.push(p)
    } else {
      ineligibleBench.push(p.id)
    }
  }

  // Sort by priority: most needs time → bench-fairness → deterministic tiebreak
  const sortByPriority = (a: Player, b: Player) => {
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
  }

  const sortedAll = [...candidates, ...forcedCandidates].sort(sortByPriority)
  const sortedBase = [...candidates].sort(sortByPriority)
  const preferredHoldIds = (pool: Player[]) =>
    new Set(pool.slice(0, outfieldSlots.length).map((player) => player.id))

  const assignments: Record<string, string | null> = {}
  if (keeperSlotId !== null) {
    assignments[keeperSlotId] = keeperPlayerId
  }

  const baseResult = assignOutfieldSlots(
    outfieldSlots,
    sortedBase,
    previousAssignments,
    canPlayPosition,
    preferredHoldIds(sortedBase),
    slotOrderOffset,
  )
  const useForcedCandidates = baseResult.unfilledCount > 0 && forcedCandidates.length > 0
  const chosenResult = useForcedCandidates
    ? assignOutfieldSlots(
      outfieldSlots,
      sortedAll,
      previousAssignments,
      canPlayPosition,
      preferredHoldIds(sortedAll),
      slotOrderOffset,
    )
    : baseResult

  for (const slot of outfieldSlots) {
    assignments[slot.slotId] = chosenResult.assignedBySlot[slot.slotId] ?? null
  }

  const bench: string[] = []
  const benchSet = new Set<string>()
  const addBench = (playerId: string) => {
    if (playerId === keeperPlayerId) return
    if (benchSet.has(playerId)) return
    if (chosenResult.assignedPlayerIds.has(playerId)) return
    benchSet.add(playerId)
    bench.push(playerId)
  }
  for (const forcedId of forcedBenchPlayerIds) addBench(forcedId)
  for (const player of sortedAll) addBench(player.id)
  for (const ineligibleId of ineligibleBench) addBench(ineligibleId)

  return { assignments, bench }
}

function assignOutfieldSlots(
  outfieldSlots: LineupSlot[],
  availablePlayers: Player[],
  previousAssignments: Record<string, string | null> | null,
  canPlayPosition: (player: Player, positionTypeId: string) => boolean,
  preferredHoldPlayerIds: Set<string>,
  slotOrderOffset: number,
): {
  assignedBySlot: Record<string, string | null>
  assignedPlayerIds: Set<string>
  unfilledCount: number
} {
  const assignedBySlot: Record<string, string | null> = {}
  const assignedPlayerIds = new Set<string>()
  const availableById = new Map(availablePlayers.map((player) => [player.id, player]))
  const remainingSlots = [...outfieldSlots]

  for (const slot of [...remainingSlots]) {
    const previousPlayerId = previousAssignments?.[slot.slotId] ?? null
    if (!previousPlayerId) continue
    if (!preferredHoldPlayerIds.has(previousPlayerId)) continue
    const player = availableById.get(previousPlayerId)
    if (!player || !canPlayPosition(player, slot.positionTypeId)) continue
    assignedBySlot[slot.slotId] = player.id
    assignedPlayerIds.add(player.id)
    availableById.delete(player.id)
    remainingSlots.splice(remainingSlots.indexOf(slot), 1)
  }

  const remainingPlayers = [...availableById.values()]
  const rotatedSlots = rotateSlots(remainingSlots, slotOrderOffset)
  const matchedBySlot = maximumMatch(rotatedSlots, remainingPlayers, canPlayPosition)
  for (const slot of remainingSlots) {
    const playerId = matchedBySlot.get(slot.slotId) ?? null
    assignedBySlot[slot.slotId] = playerId
    if (playerId) assignedPlayerIds.add(playerId)
  }

  const unfilledCount = outfieldSlots.reduce(
    (count, slot) => count + (assignedBySlot[slot.slotId] ? 0 : 1),
    0,
  )
  return { assignedBySlot, assignedPlayerIds, unfilledCount }
}

function rotateSlots(slots: LineupSlot[], offset: number): LineupSlot[] {
  if (slots.length <= 1) return slots
  // Keep offset in [0, slots.length) even when caller provides a negative value.
  const normalized = ((offset % slots.length) + slots.length) % slots.length
  if (normalized === 0) return slots
  return [...slots.slice(normalized), ...slots.slice(0, normalized)]
}

function maximumMatch(
  slots: LineupSlot[],
  players: Player[],
  canPlayPosition: (player: Player, positionTypeId: string) => boolean,
): Map<string, string> {
  const candidatesBySlot = new Map<string, Player[]>()
  for (const slot of slots) {
    candidatesBySlot.set(
      slot.slotId,
      players.filter((player) => canPlayPosition(player, slot.positionTypeId)),
    )
  }

  const matchedSlotByPlayer = new Map<string, string>()
  const matchedPlayerBySlot = new Map<string, string>()

  // DFS augmenting-path search: rematch players when needed to maximize filled slots.
  const assign = (slotId: string, visited: Set<string>): boolean => {
    const candidates = candidatesBySlot.get(slotId) ?? []
    for (const player of candidates) {
      if (visited.has(player.id)) continue
      visited.add(player.id)
      const currentSlotId = matchedSlotByPlayer.get(player.id)
      if (!currentSlotId || assign(currentSlotId, visited)) {
        matchedSlotByPlayer.set(player.id, slotId)
        matchedPlayerBySlot.set(slotId, player.id)
        return true
      }
    }
    return false
  }

  for (const slot of slots) {
    assign(slot.slotId, new Set<string>())
  }

  return matchedPlayerBySlot
}
