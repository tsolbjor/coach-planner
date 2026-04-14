import { nanoid } from 'nanoid'
import type { TimeSlot } from '../types'
import type { SchedulerInput, SchedulerOutput, PlayerScore } from './types'
import { buildSegments } from './segmentBuilder'
import { assignKeeper } from './keeperRotation'
import { assignField } from './fieldRotation'

export function generatePlan(input: SchedulerInput): SchedulerOutput {
  const { sportConfig, players, benchStintMinutes, matchCount = 1, existingSlots = [] } = input
  const warnings: SchedulerOutput['warnings'] = []

  if (players.length === 0) {
    return { slots: [], warnings: [{ kind: 'low-player-count', message: 'No players in roster.' }] }
  }

  const segments = buildSegments(sportConfig, benchStintMinutes, matchCount)
  const segmentDuration = segments.length > 0 ? (segments[0]!.endMinute - segments[0]!.startMinute) : benchStintMinutes
  const keeperSlot = sportConfig.lineupSlots.find((s) => {
    const pt = sportConfig.positionTypes.find((pt) => pt.id === s.positionTypeId)
    return pt?.isKeeper
  })
  const keeperSlotId = keeperSlot?.slotId ?? null
  const keeperPositionTypeId = keeperSlot?.positionTypeId ?? null
  const keeperMinSegments = (() => {
    if (!keeperSlot) return 1
    const pt = sportConfig.positionTypes.find((p) => p.id === keeperSlot.positionTypeId)
    const rotateEvery = pt?.rotateEveryMinutes ?? 0
    return rotateEvery > 0 ? Math.max(1, Math.round(rotateEvery / segmentDuration)) : 1
  })()

  // Warn early if bench rotation is mathematically impossible
  const benchSpotsPerSeg = players.length - sportConfig.totalOnField
  const totalBenchSlots = segments.length * benchSpotsPerSeg
  if (benchSpotsPerSeg <= 0) {
    warnings.push({
      kind: 'bench-rotation-impossible',
      message: 'Every player is needed on the field — no one can be benched. Add more players to allow rotation.',
    })
  } else if (totalBenchSlots < players.length) {
    warnings.push({
      kind: 'bench-rotation-impossible',
      message: `Only ${totalBenchSlots} bench stints across the match for ${players.length} players — not everyone can sit out once. Increase substitutions or add players.`,
    })
  }

  // Initialise scores
  const scores = new Map<string, PlayerScore>()
  for (const p of players) {
    scores.set(p.id, {
      playerId: p.id,
      fieldMinutes: 0,
      keeperMinutes: 0,
      consecutiveBench: 0,
      consecutiveFieldSegments: 0,
      benchSegments: 0,
      consecutiveKeeperSegments: 0,
      lastBenchedSegment: -1,
    })
  }

  let lastKeeperPlayerId: string | null = null
  let previousAssignments: Record<string, string | null> | null = null

  // Pre-populate scores from locked existing slots
  const lockedSlots = existingSlots.filter((s) => s.locked)
  for (const slot of lockedSlots) {
    const duration = slot.endMinute - slot.startMinute
    for (const [, playerId] of Object.entries(slot.assignments)) {
      if (!playerId) continue
      const score = scores.get(playerId)
      if (!score) continue
      if (keeperSlotId && slot.assignments[keeperSlotId] === playerId) {
        score.keeperMinutes += duration
      } else {
        score.fieldMinutes += duration
      }
      score.consecutiveBench = 0
    }
    for (const benchId of slot.bench) {
      const score = scores.get(benchId)
      if (score) {
        score.consecutiveBench++
        score.benchSegments++
        const matchedSeg = segments.find(
          (seg) =>
            seg.startMinute === slot.startMinute &&
            seg.periodIndex === slot.periodIndex &&
            seg.matchIndex === (slot.matchIndex ?? 0),
        )
        if (matchedSeg) score.lastBenchedSegment = matchedSeg.segmentIndex
      }
    }
  }

  const lockedBySegment = new Map(
    lockedSlots.map((s) => [
      segments.find(
        (seg) =>
          seg.startMinute === s.startMinute &&
          seg.periodIndex === s.periodIndex &&
          seg.matchIndex === (s.matchIndex ?? 0),
      )?.segmentIndex ?? -1,
      s,
    ]),
  )

  const resultSlots: TimeSlot[] = []
  let currentMatchIndex = -1

  for (const seg of segments) {
    // At each match boundary: reset per-match keeper state so each game starts fresh.
    // Accumulated pitch/bench minutes carry over for cross-match fairness.
    if (seg.matchIndex !== currentMatchIndex) {
      currentMatchIndex = seg.matchIndex
      lastKeeperPlayerId = null
      previousAssignments = null
      for (const score of scores.values()) {
        score.consecutiveKeeperSegments = 0
        score.consecutiveFieldSegments = 0
      }
    }

    const previousSlot = resultSlots[resultSlots.length - 1] ?? null
    const samePeriodAsPrevious = previousSlot !== null
      && previousSlot.matchIndex === seg.matchIndex
      && previousSlot.periodIndex === seg.periodIndex

    const locked = lockedBySegment.get(seg.segmentIndex)
    if (locked) {
      resultSlots.push(locked)
      lastKeeperPlayerId = keeperSlotId ? (locked.assignments[keeperSlotId] ?? null) : null
      previousAssignments = locked.assignments
      // Update consecutiveFieldSegments in segment order (not done in pre-population)
      const fieldPlayerIds = new Set(Object.values(locked.assignments).filter(Boolean))
      for (const score of scores.values()) {
        if (fieldPlayerIds.has(score.playerId)) {
          score.consecutiveFieldSegments++
        } else {
          score.consecutiveFieldSegments = 0
        }
      }
      continue
    }

    // Keeper assignment
    const previousBenchIds = samePeriodAsPrevious && previousSlot ? previousSlot.bench : []
    const keeperPlayerId = keeperSlotId && keeperPositionTypeId
      ? assignKeeper(
          players,
          scores,
          keeperPositionTypeId,
          lastKeeperPlayerId,
          keeperMinSegments,
          previousBenchIds,
          samePeriodAsPrevious,
          warnings,
        )
      : null
    const forcedBenchPlayerIds =
      samePeriodAsPrevious && lastKeeperPlayerId && keeperPlayerId && keeperPlayerId !== lastKeeperPlayerId
        ? [lastKeeperPlayerId]
        : []
    lastKeeperPlayerId = keeperPlayerId

    // Field player assignment
    const { assignments, bench } = assignField(
      players,
      sportConfig.lineupSlots,
      keeperSlotId,
      keeperPlayerId,
      forcedBenchPlayerIds,
      scores,
      previousAssignments,
    )

    const dur = seg.endMinute - seg.startMinute

    // Update scores
    const fieldPlayerIds = new Set(Object.values(assignments).filter(Boolean))
    for (const [slotId, playerId] of Object.entries(assignments)) {
      if (!playerId) continue
      const score = scores.get(playerId)
      if (!score) continue
      if (slotId === keeperSlotId) {
        score.keeperMinutes += dur
        score.consecutiveKeeperSegments++
      } else {
        score.fieldMinutes += dur
        score.consecutiveKeeperSegments = 0
      }
      score.consecutiveBench = 0
      score.consecutiveFieldSegments++
    }
    for (const benchId of bench) {
      const score = scores.get(benchId)
      if (score) {
        score.consecutiveBench++
        score.benchSegments++
        score.consecutiveKeeperSegments = 0
        score.consecutiveFieldSegments = 0
        score.lastBenchedSegment = seg.segmentIndex
      }
    }

    resultSlots.push({
      id: nanoid(8),
      matchIndex: seg.matchIndex,
      periodIndex: seg.periodIndex,
      startMinute: seg.startMinute,
      endMinute: seg.endMinute,
      assignments,
      bench,
      locked: false,
    })
    previousAssignments = assignments
  }

  if (players.length < sportConfig.totalOnField) {
    warnings.push({
      kind: 'low-player-count',
      message: `Only ${players.length} players available, need ${sportConfig.totalOnField} on field. Some positions will be empty.`,
    })
  }

  return { slots: resultSlots, warnings }
}
