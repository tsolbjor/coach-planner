import { normalizePlayerLevel, type Player, type PlayerLevel, type LineupSlot } from '../types'
import type { PlayerScore } from './types'

const MAX_CONSECUTIVE_BENCH = 1
const PLAYER_LEVELS: PlayerLevel[] = [1, 2, 3]
const MAX_BENCH_L1 = 1

type LevelCounts = Record<PlayerLevel, number>

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
  const ineligibleBench: Player[] = []
  for (const p of players) {
    if (p.id === keeperPlayerId) continue
    if (outfieldSlots.some((slot) => canPlayPosition(p, slot.positionTypeId))) {
      if (forcedBenchSet.has(p.id)) forcedCandidates.push(p)
      else candidates.push(p)
    } else {
      ineligibleBench.push(p)
    }
  }

  const createSortByPriority = (
    pool: Player[],
    fixedBench: Player[],
  ) => {
    const { benchNeedsByLevel, poolCountsByLevel } = buildBenchLevelContext(
      pool,
      fixedBench,
      outfieldSlots.length,
    )

    return (a: Player, b: Player) => {
      const sa = scores.get(a.id)!
      const sb = scores.get(b.id)!

      // 1. Force players who've hit max consecutive bench to the front (safety valve)
      const aForced = sa.consecutiveBench >= MAX_CONSECUTIVE_BENCH ? 1 : 0
      const bForced = sb.consecutiveBench >= MAX_CONSECUTIVE_BENCH ? 1 : 0
      if (aForced !== bForced) return bForced - aForced

      // 2. Equalise total pitch time — keeper time counts the same as field time
      const totalA = sa.fieldMinutes + sa.keeperMinutes
      const totalB = sb.fieldMinutes + sb.keeperMinutes
      if (totalA !== totalB) return totalA - totalB

      // 3. Spread bench spots across levels when minutes are otherwise comparable
      const levelA = normalizePlayerLevel(a.level)
      const levelB = normalizePlayerLevel(b.level)
      const levelPressureA = benchNeedsByLevel[levelA] * poolCountsByLevel[levelB]
      const levelPressureB = benchNeedsByLevel[levelB] * poolCountsByLevel[levelA]
      if (levelPressureA !== levelPressureB) return levelPressureA - levelPressureB
      if (benchNeedsByLevel[levelA] !== benchNeedsByLevel[levelB]) {
        return benchNeedsByLevel[levelA] - benchNeedsByLevel[levelB]
      }

      // 4. Sub the player on pitch the longest — maximises each player's unbroken run
      if (sa.consecutiveFieldSegments !== sb.consecutiveFieldSegments) {
        return sa.consecutiveFieldSegments - sb.consecutiveFieldSegments
      }

      // 5. Players with more bench stints get higher field priority (compensatory fairness)
      if (sa.benchSegments !== sb.benchSegments) return sb.benchSegments - sa.benchSegments

      // 6. FIFO: whoever was benched longest ago gets benched again first
      if (sa.lastBenchedSegment !== sb.lastBenchedSegment) return sb.lastBenchedSegment - sa.lastBenchedSegment

      // 7. Deterministic tiebreak
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    }
  }

  const sortedAll = [...candidates, ...forcedCandidates].sort(
    createSortByPriority([...candidates, ...forcedCandidates], ineligibleBench),
  )
  const sortedBase = [...candidates].sort(
    createSortByPriority(candidates, [...forcedCandidates, ...ineligibleBench]),
  )
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
  for (const ineligiblePlayer of ineligibleBench) addBench(ineligiblePlayer.id)

  return { assignments, bench }
}

function emptyLevelCounts(): LevelCounts {
  return { 1: 0, 2: 0, 3: 0 }
}

function countPlayersByLevel(players: Player[]): LevelCounts {
  const counts = emptyLevelCounts()
  for (const player of players) {
    counts[normalizePlayerLevel(player.level)]++
  }
  return counts
}

function buildBenchLevelContext(
  pool: Player[],
  fixedBench: Player[],
  fieldSlots: number,
): {
  benchNeedsByLevel: LevelCounts
  poolCountsByLevel: LevelCounts
} {
  const poolCountsByLevel = countPlayersByLevel(pool)
  const fixedBenchCounts = countPlayersByLevel(fixedBench)
  const totalCounts = emptyLevelCounts()
  const totalBenchSlots = Math.max(0, pool.length + fixedBench.length - fieldSlots)
  const maxBenchL3 = Math.floor((2 * totalBenchSlots) / 3)
  const benchCapsByLevel = emptyLevelCounts()

  for (const level of PLAYER_LEVELS) {
    totalCounts[level] = poolCountsByLevel[level] + fixedBenchCounts[level]
  }

  benchCapsByLevel[1] = totalBenchSlots > 0 ? Math.min(totalCounts[1], MAX_BENCH_L1) : 0
  benchCapsByLevel[2] = totalCounts[2]
  benchCapsByLevel[3] = Math.min(totalCounts[3], maxBenchL3)

  const benchTargetsByLevel = { ...fixedBenchCounts }
  let remainingBenchSlots = Math.max(0, pool.length - fieldSlots)

  while (remainingBenchSlots > 0) {
    let selectedLevel: PlayerLevel | null = null

    for (const level of PLAYER_LEVELS) {
      if (benchTargetsByLevel[level] >= totalCounts[level]) continue
      if (benchTargetsByLevel[level] >= benchCapsByLevel[level]) continue

      if (selectedLevel === null) {
        selectedLevel = level
        continue
      }

      const levelTarget = benchTargetsByLevel[level]
      const selectedTarget = benchTargetsByLevel[selectedLevel]
      const levelRemainingCapacity = totalCounts[level] - levelTarget
      const selectedRemainingCapacity = totalCounts[selectedLevel] - selectedTarget

      if (levelTarget < selectedTarget) {
        selectedLevel = level
        continue
      }

      if (levelTarget === selectedTarget && levelRemainingCapacity > selectedRemainingCapacity) {
        selectedLevel = level
      }
    }

    if (selectedLevel === null) break

    benchTargetsByLevel[selectedLevel]++
    remainingBenchSlots--
  }

  const benchNeedsByLevel = emptyLevelCounts()
  for (const level of PLAYER_LEVELS) {
    benchNeedsByLevel[level] = Math.max(
      0,
      Math.min(poolCountsByLevel[level], benchTargetsByLevel[level] - fixedBenchCounts[level]),
    )
  }

  return { benchNeedsByLevel, poolCountsByLevel }
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
