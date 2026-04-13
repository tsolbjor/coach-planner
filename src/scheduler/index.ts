import { nanoid } from 'nanoid'
import type { TimeSlot } from '../types'
import type { SchedulerInput, SchedulerOutput, PlayerScore } from './types'
import { buildSegments } from './segmentBuilder'
import { assignKeeper } from './keeperRotation'
import { assignField } from './fieldRotation'

export function generatePlan(input: SchedulerInput): SchedulerOutput {
  const { sportConfig, players, subsPerPeriod, keeperMode, existingSlots = [] } = input
  const warnings: SchedulerOutput['warnings'] = []

  if (players.length === 0) {
    return { slots: [], warnings: [{ kind: 'low-player-count', message: 'No players in roster.' }] }
  }

  const segments = buildSegments(sportConfig, subsPerPeriod)
  const keeperSlot = sportConfig.lineupSlots.find((s) => {
    const pt = sportConfig.positionTypes.find((pt) => pt.id === s.positionTypeId)
    return pt?.isKeeper
  })
  const keeperSlotId = keeperSlot?.slotId ?? null

  // Initialise scores
  const scores = new Map<string, PlayerScore>()
  for (const p of players) {
    scores.set(p.id, {
      playerId: p.id,
      fieldMinutes: 0,
      keeperSegments: 0,
      consecutiveBench: 0,
      recentSlotIds: [],
    })
  }

  // Pre-populate scores from locked existing slots
  const lockedSlots = existingSlots.filter((s) => s.locked)
  for (const slot of lockedSlots) {
    const duration = slot.endMinute - slot.startMinute
    for (const [, playerId] of Object.entries(slot.assignments)) {
      if (!playerId) continue
      const score = scores.get(playerId)
      if (!score) continue
      if (keeperSlotId && slot.assignments[keeperSlotId] === playerId) {
        score.keeperSegments++
      } else {
        score.fieldMinutes += duration
      }
      score.consecutiveBench = 0
    }
    for (const benchId of slot.bench) {
      const score = scores.get(benchId)
      if (score) score.consecutiveBench++
    }
  }

  const lockedBySegment = new Map(
    lockedSlots.map((s) => [
      segments.find(
        (seg) => seg.startMinute === s.startMinute && seg.periodIndex === s.periodIndex,
      )?.segmentIndex ?? -1,
      s,
    ]),
  )

  const resultSlots: TimeSlot[] = []

  for (const seg of segments) {
    const locked = lockedBySegment.get(seg.segmentIndex)
    if (locked) {
      resultSlots.push(locked)
      // Scores already pre-populated above
      continue
    }

    // Keeper assignment
    const keeperPlayerId = keeperSlotId
      ? assignKeeper(players, scores, keeperMode, warnings)
      : null

    // Field player assignment
    const { assignments, bench } = assignField(
      players,
      sportConfig.lineupSlots,
      keeperSlotId,
      keeperPlayerId,
      scores,
      seg.segmentIndex,
    )

    const segmentDuration = seg.endMinute - seg.startMinute

    // Update scores
    for (const [slotId, playerId] of Object.entries(assignments)) {
      if (!playerId) continue
      const score = scores.get(playerId)
      if (!score) continue
      if (slotId === keeperSlotId) {
        score.keeperSegments++
      } else {
        score.fieldMinutes += segmentDuration
      }
      score.consecutiveBench = 0
    }
    for (const benchId of bench) {
      const score = scores.get(benchId)
      if (score) score.consecutiveBench++
    }

    resultSlots.push({
      id: nanoid(8),
      periodIndex: seg.periodIndex,
      startMinute: seg.startMinute,
      endMinute: seg.endMinute,
      assignments,
      bench,
      locked: false,
    })
  }

  if (players.length < sportConfig.totalOnField) {
    warnings.push({
      kind: 'low-player-count',
      message: `Only ${players.length} players available, need ${sportConfig.totalOnField} on field. Some positions will be empty.`,
    })
  }

  return { slots: resultSlots, warnings }
}
