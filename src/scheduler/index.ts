import { nanoid } from 'nanoid'
import type { SegmentPin, TimeSlot } from '../types'
import type { SchedulerInput, SchedulerOutput, SchedulerWarning } from './types'
import { buildSegments } from './segmentBuilder'
import { checkFeasibility } from './feasibility'
import { solveRotation } from './rotationSolver'
import { buildPositionOverlay } from './positionOverlay'

export function generatePlan(input: SchedulerInput): SchedulerOutput {
  const {
    sportConfig,
    players,
    benchStintMinutes,
    matchCount = 1,
    pins = {},
    changeKeeperMidPeriod = false,
  } = input
  const warnings: SchedulerWarning[] = []

  if (players.length === 0) {
    return { slots: [], warnings: [{ kind: 'low-player-count', message: 'No players in roster.' }] }
  }

  warnings.push(
    ...checkFeasibility({ sportConfig, players, benchStintMinutes, matchCount, pins }),
  )

  const segments = buildSegments(sportConfig, benchStintMinutes, matchCount)
  const rot = solveRotation({ sportConfig, players, segments, pins, changeKeeperMidPeriod })
  warnings.push(...rot.warnings)

  const overlay = buildPositionOverlay({
    sportConfig,
    players,
    segments,
    gkBySegment: rot.gkBySegment,
    fieldBySegment: rot.fieldBySegment,
  })
  warnings.push(...overlay.warnings)

  const slots: TimeSlot[] = segments.map((seg) => {
    const swap = rot.midSwapBySegment.get(seg.segmentIndex)
    const positions = overlay.positionsBySegment.get(seg.segmentIndex) ?? {}
    let midSwap: TimeSlot['midSwap']
    if (swap) {
      const keeperSlotId = sportConfig.lineupSlots.find((s) => {
        const pt = sportConfig.positionTypes.find((p) => p.id === s.positionTypeId)
        return pt?.isKeeper
      })?.slotId
      // Pre-positions: same as post but swap keeper + the player who took keeper's vacated field slot.
      const prePositions: Record<string, string | null> = { ...positions }
      if (keeperSlotId) prePositions[keeperSlotId] = swap.preGkId
      // The incoming keeper held a field slot pre-swap; the outgoing keeper now holds it post-swap.
      // Find that slot and flip back to incoming for prePositions.
      const incomingKeeperId = rot.gkBySegment[seg.segmentIndex] ?? null
      const outgoingKeeperId = swap.preGkId
      if (incomingKeeperId && outgoingKeeperId) {
        for (const [slotId, pid] of Object.entries(positions)) {
          if (slotId === keeperSlotId) continue
          if (pid === outgoingKeeperId) {
            prePositions[slotId] = incomingKeeperId
            break
          }
        }
      }
      midSwap = {
        atMinute: swap.atMinute,
        preGkId: swap.preGkId,
        preFieldIds: swap.preFieldIds,
        preBenchIds: swap.preBenchIds,
        prePositions,
      }
    }
    return {
      id: nanoid(8),
      matchIndex: seg.matchIndex,
      periodIndex: seg.periodIndex,
      startMinute: seg.startMinute,
      endMinute: seg.endMinute,
      gkId: rot.gkBySegment[seg.segmentIndex] ?? null,
      fieldIds: rot.fieldBySegment[seg.segmentIndex] ?? [],
      benchIds: rot.benchBySegment[seg.segmentIndex] ?? [],
      absentIds: [
        ...(pins[seg.segmentIndex]?.absentIds ?? []),
        ...(pins[seg.segmentIndex]?.absentCreditedIds ?? []),
      ],
      absentCreditedIds: pins[seg.segmentIndex]?.absentCreditedIds ?? [],
      positions,
      midSwap,
    }
  })

  return { slots, warnings: dedupeWarnings(warnings) }
}

export type { SegmentPin }

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
