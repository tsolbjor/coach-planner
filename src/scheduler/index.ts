import { nanoid } from 'nanoid'
import type { TimeSlot } from '../types'
import type { SchedulerInput, SchedulerOutput, SchedulerWarning } from './types'
import { buildSegments } from './segmentBuilder'
import { checkFeasibility } from './feasibility'
import { planKeepers } from './keeperPlan'
import { scheduleBench, type LockedBench } from './benchSchedule'
import { assignPositions } from './positionAssign'

export function generatePlan(input: SchedulerInput): SchedulerOutput {
  const { sportConfig, players, benchStintMinutes, matchCount = 1, existingSlots = [] } = input
  const warnings: SchedulerWarning[] = []

  if (players.length === 0) {
    return { slots: [], warnings: [{ kind: 'low-player-count', message: 'No players in roster.' }] }
  }

  warnings.push(
    ...checkFeasibility({
      sportConfig,
      players,
      benchStintMinutes,
      matchCount,
      existingSlots,
    }),
  )

  const segments = buildSegments(sportConfig, benchStintMinutes, matchCount)
  const segmentByLocation = new Map<string, number>()
  for (const seg of segments) {
    segmentByLocation.set(`${seg.matchIndex}:${seg.periodIndex}:${seg.startMinute}`, seg.segmentIndex)
  }

  const keeperSlotId =
    sportConfig.lineupSlots.find((s) => {
      const pt = sportConfig.positionTypes.find((p) => p.id === s.positionTypeId)
      return pt?.isKeeper
    })?.slotId ?? null

  const lockedBench = new Map<number, LockedBench>()
  const lockedKeeper = new Map<number, string | null>()
  const lockedAssignments = new Map<number, Record<string, string | null>>()
  const lockedSlotById = new Map<number, TimeSlot>()
  for (const slot of existingSlots) {
    if (!slot.locked) continue
    const segIdx = segmentByLocation.get(`${slot.matchIndex}:${slot.periodIndex}:${slot.startMinute}`)
    if (segIdx === undefined) continue
    lockedBench.set(segIdx, {
      bench: [...slot.bench],
      field: new Set(Object.values(slot.assignments).filter((v): v is string => v !== null)),
    })
    lockedAssignments.set(segIdx, { ...slot.assignments })
    if (keeperSlotId) lockedKeeper.set(segIdx, slot.assignments[keeperSlotId] ?? null)
    lockedSlotById.set(segIdx, slot)
  }

  const keeperResult = planKeepers({ sportConfig, players, segments, lockedKeeper })
  warnings.push(...keeperResult.warnings)

  const forcedField = new Map<number, Set<string>>()
  for (const seg of segments) {
    const id = keeperResult.keeperByPeriod.get(`${seg.matchIndex}:${seg.periodIndex}`)
    if (id) forcedField.set(seg.segmentIndex, new Set([id]))
  }

  const benchResult = scheduleBench({
    sportConfig,
    players,
    segments,
    locks: lockedBench,
    forcedField,
  })
  warnings.push(...benchResult.warnings)

  const positionResult = assignPositions({
    sportConfig,
    players,
    segments,
    benchBySegment: benchResult.benchBySegment,
    keeperByPeriod: keeperResult.keeperByPeriod,
    lockedAssignments,
  })
  warnings.push(...positionResult.warnings)

  const resultSlots: TimeSlot[] = segments.map((seg) => {
    const locked = lockedSlotById.get(seg.segmentIndex)
    if (locked) return locked
    return {
      id: nanoid(8),
      matchIndex: seg.matchIndex,
      periodIndex: seg.periodIndex,
      startMinute: seg.startMinute,
      endMinute: seg.endMinute,
      assignments: positionResult.assignmentsBySegment.get(seg.segmentIndex) ?? {},
      bench: benchResult.benchBySegment[seg.segmentIndex] ?? [],
      locked: false,
    }
  })

  return { slots: resultSlots, warnings: dedupeWarnings(warnings) }
}

function dedupeWarnings(warnings: SchedulerWarning[]): SchedulerWarning[] {
  const seen = new Set<string>()
  const out: SchedulerWarning[] = []
  for (const w of warnings) {
    const key = `${w.kind}::${w.message}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(w)
  }
  return out
}
