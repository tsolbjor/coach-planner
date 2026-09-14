import type { SegmentPin, TimeSlot } from '../types'
import type { SchedulerInput, SchedulerOutput, SchedulerWarning, Segment } from './types'
import { buildSegments } from './segmentBuilder'
import { checkFeasibility } from './feasibility'
import { solveRotation } from './rotationSolver'
import { buildPositionOverlay } from './positionOverlay'

export function generatePlan(input: SchedulerInput): SchedulerOutput {
  const { sportConfig, players, benchStintMinutes, matchCount = 1, pins = {},
    changeKeeperMidPeriod = false, lockedSlots = [] } = input
  const warnings: SchedulerWarning[] = []
  let segments: Segment[]
  try {
    segments = buildSegments(sportConfig, benchStintMinutes, matchCount, changeKeeperMidPeriod)
    if (!Number.isSafeInteger(sportConfig.totalOnField) || sportConfig.totalOnField < 1 ||
      sportConfig.lineupSlots.length !== sportConfig.totalOnField ||
      new Set(players.map((p) => p.id)).size !== players.length ||
      players.some((p) => !p.id) ||
      new Set(sportConfig.lineupSlots.map((s) => s.slotId)).size !== sportConfig.lineupSlots.length ||
      sportConfig.lineupSlots.some((s) => !sportConfig.positionTypes.some((p) => p.id === s.positionTypeId)) ||
      sportConfig.lineupSlots.filter((s) => sportConfig.positionTypes.find((p) => p.id === s.positionTypeId)?.isKeeper).length > 1) {
      throw new RangeError('Roster IDs and lineup slots must be unique, with valid positions and the configured field count.')
    }
    if ((input.maxBenchSegments !== undefined && (!Number.isFinite(input.maxBenchSegments) || input.maxBenchSegments < 1)) ||
      [input.minSubsPerSegment, input.maxSubsPerSegment].some((value) =>
        value !== undefined && (!Number.isSafeInteger(value) || value < 0))) {
      throw new RangeError('Bench limit must be finite and at least one; substitution limits must be nonnegative integers.')
    }
    if (lockedSlots.some((slot, index) => {
      const seg = segments[index]
      return !seg || slot.matchIndex !== seg.matchIndex || slot.periodIndex !== seg.periodIndex ||
        Math.abs(slot.startMinute - seg.startMinute) > 1e-8 || Math.abs(slot.endMinute - seg.endMinute) > 1e-8 ||
        !Number.isFinite(slot.startMinute) || !Number.isFinite(slot.endMinute) ||
        (slot.midSwap && (!Number.isFinite(slot.midSwap.atMinute) ||
          slot.midSwap.atMinute <= slot.startMinute || slot.midSwap.atMinute >= slot.endMinute))
    })) throw new RangeError('Locked history must be an exact contiguous prefix of the configured intervals; timing changes are not allowed.')
  } catch (error) {
    return { slots: structuredClone(lockedSlots), warnings: [{
      kind: 'invalid-input', message: error instanceof Error ? error.message : 'Invalid scheduling input.',
    }] }
  }
  if (players.length === 0 && !lockedSlots.length) {
    return { slots: [], warnings: [{ kind: 'low-player-count', message: 'No players in roster.' }] }
  }
  warnings.push(...checkFeasibility({ sportConfig, players, benchStintMinutes, matchCount, pins }))
  for (const key of Object.keys(pins)) {
    const index = Number(key)
    if (!Number.isSafeInteger(index) || index < 0 || index >= segments.length) {
      warnings.push({ kind: 'lock-conflict', message: `Pin at segment index ${key} is outside this schedule and was ignored.` })
    }
  }
  const rot = solveRotation({ ...input, segments, pins })
  warnings.push(...rot.warnings)
  const overlay = buildPositionOverlay({
    sportConfig, players, segments, lockedSlots,
    gkBySegment: rot.gkBySegment, fieldBySegment: rot.fieldBySegment,
  })
  warnings.push(...overlay.warnings)
  const playerIds = new Set(players.map((p) => p.id))
  const slots: TimeSlot[] = segments.map((seg) => {
    const locked = lockedSlots[seg.segmentIndex]
    if (locked) return structuredClone(locked)
    const pin = pins[seg.segmentIndex]
    return {
      id: `slot-${seg.matchIndex}-${seg.periodIndex}-${seg.startMinute}-${seg.endMinute}`,
      matchIndex: seg.matchIndex,
      periodIndex: seg.periodIndex,
      startMinute: seg.startMinute,
      endMinute: seg.endMinute,
      gkId: rot.gkBySegment[seg.segmentIndex] ?? null,
      fieldIds: rot.fieldBySegment[seg.segmentIndex] ?? [],
      benchIds: rot.benchBySegment[seg.segmentIndex] ?? [],
      absentIds: [...new Set([...(pin?.absentIds ?? []), ...(pin?.absentCreditedIds ?? [])])].filter((id) => playerIds.has(id)),
      absentCreditedIds: [...new Set(pin?.absentCreditedIds ?? [])].filter((id) => playerIds.has(id)),
      positions: overlay.positionsBySegment.get(seg.segmentIndex) ?? {},
    }
  })
  return { slots, warnings: warnings.filter((warning, index) =>
    warnings.findIndex((other) => other.kind === warning.kind && other.message === warning.message) === index) }
}

export type { SegmentPin }
