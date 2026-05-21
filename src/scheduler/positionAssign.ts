import type { Player, SportConfig } from '../types'
import type { Segment, SchedulerWarning } from './types'
import { canPlayPosition, maxMatch } from './maxMatch'

export interface PositionAssignInput {
  sportConfig: SportConfig
  players: Player[]
  segments: Segment[]
  /** segmentIndex → bench player ids */
  benchBySegment: string[][]
  /** `${matchIndex}:${periodIndex}` → designated keeper for that whole period */
  keeperByPeriod: Map<string, string | null>
  /** segmentIndex → fully locked assignments (overrides everything for that segment) */
  lockedAssignments: Map<number, Record<string, string | null>>
}

export interface PositionAssignResult {
  /** segmentIndex → slotId → playerId|null */
  assignmentsBySegment: Map<number, Record<string, string | null>>
  warnings: SchedulerWarning[]
}

export function assignPositions(input: PositionAssignInput): PositionAssignResult {
  const { sportConfig, players, segments, benchBySegment, keeperByPeriod, lockedAssignments } = input
  const warnings: SchedulerWarning[] = []
  const assignmentsBySegment = new Map<number, Record<string, string | null>>()

  const keeperSlotId =
    sportConfig.lineupSlots.find((s) => {
      const pt = sportConfig.positionTypes.find((p) => p.id === s.positionTypeId)
      return pt?.isKeeper
    })?.slotId ?? null
  const outfieldSlots = sportConfig.lineupSlots.filter((s) => s.slotId !== keeperSlotId)
  const playersById = new Map(players.map((p) => [p.id, p]))

  const sortedSegments = [...segments].sort((a, b) => a.segmentIndex - b.segmentIndex)
  let prevAssignments: Record<string, string | null> | null = null
  let prevMatchIndex = -1
  let prevPeriodIndex = -1

  for (const seg of sortedSegments) {
    const samePeriod =
      seg.matchIndex === prevMatchIndex && seg.periodIndex === prevPeriodIndex
    if (seg.matchIndex !== prevMatchIndex) {
      prevAssignments = null
    }

    const lockedAssign = lockedAssignments.get(seg.segmentIndex)
    if (lockedAssign) {
      assignmentsBySegment.set(seg.segmentIndex, { ...lockedAssign })
      prevAssignments = lockedAssign
      prevMatchIndex = seg.matchIndex
      prevPeriodIndex = seg.periodIndex
      continue
    }

    const benchSet = new Set(benchBySegment[seg.segmentIndex] ?? [])
    const fieldPlayers = players.filter((p) => !benchSet.has(p.id))
    const periodKey = `${seg.matchIndex}:${seg.periodIndex}`
    const designatedKeeper = keeperByPeriod.get(periodKey) ?? null

    const assignments: Record<string, string | null> = {}

    let keeperPlayerId: string | null = null
    if (keeperSlotId) {
      if (designatedKeeper && fieldPlayers.some((p) => p.id === designatedKeeper)) {
        keeperPlayerId = designatedKeeper
      } else if (fieldPlayers.length > 0) {
        // Fallback: pick any keeper-eligible field player.
        const keeperPosId = sportConfig.positionTypes.find((pt) => pt.isKeeper)?.id ?? null
        const fallback = keeperPosId
          ? fieldPlayers.find((p) => canPlayPosition(p, keeperPosId)) ?? null
          : null
        keeperPlayerId = fallback?.id ?? null
        if (designatedKeeper && keeperPlayerId !== designatedKeeper) {
          warnings.push({
            kind: 'keeper-unavailable',
            message: `Designated keeper unavailable at match ${seg.matchIndex + 1} period ${seg.periodIndex + 1}; substitute used.`,
          })
        }
      }
      assignments[keeperSlotId] = keeperPlayerId
    }

    const outfieldPool = fieldPlayers.filter((p) => p.id !== keeperPlayerId)

    if (samePeriod && prevAssignments) {
      const continuityResult = assignWithContinuity(outfieldSlots, outfieldPool, prevAssignments)
      for (const slot of outfieldSlots) {
        assignments[slot.slotId] = continuityResult[slot.slotId] ?? null
      }
    } else {
      const matched = maxMatch(outfieldSlots, outfieldPool, canPlayPosition)
      for (const slot of outfieldSlots) {
        assignments[slot.slotId] = matched.get(slot.slotId) ?? null
      }
    }

    assignmentsBySegment.set(seg.segmentIndex, assignments)
    prevAssignments = assignments
    prevMatchIndex = seg.matchIndex
    prevPeriodIndex = seg.periodIndex
  }

  return { assignmentsBySegment, warnings }
}

/**
 * Within a period: returning field players keep their previous slot, and bench-in
 * players take vacated slots via max-match. If a bench-in player can't fit a vacated
 * slot (eligibility conflict), try a single-step swap with a returner whose slot the
 * bench-in player CAN fill. Only when no such direct swap exists do we fall back to
 * a global augmenting match — that keeps the number of disturbed returners minimal.
 */
function assignWithContinuity(
  outfieldSlots: { slotId: string; positionTypeId: string; label: string }[],
  outfieldPool: Player[],
  prevAssignments: Record<string, string | null>,
): Record<string, string | null> {
  const result: Record<string, string | null> = {}
  const playersById = new Map(outfieldPool.map((p) => [p.id, p]))
  const usedPlayers = new Set<string>()
  const vacatedSlots: typeof outfieldSlots = []
  const preferPlayerBySlot = new Map<string, string>()

  for (const slot of outfieldSlots) {
    const prevPlayerId = prevAssignments[slot.slotId] ?? null
    const prevPlayer = prevPlayerId ? playersById.get(prevPlayerId) : null
    if (prevPlayer && canPlayPosition(prevPlayer, slot.positionTypeId)) {
      result[slot.slotId] = prevPlayer.id
      usedPlayers.add(prevPlayer.id)
      preferPlayerBySlot.set(slot.slotId, prevPlayer.id)
    } else {
      vacatedSlots.push(slot)
    }
  }

  const remainingPool = outfieldPool.filter((p) => !usedPlayers.has(p.id))
  const matched = maxMatch(vacatedSlots, remainingPool, canPlayPosition)
  for (const slot of vacatedSlots) {
    const pid = matched.get(slot.slotId)
    if (pid) {
      result[slot.slotId] = pid
      usedPlayers.add(pid)
    } else {
      result[slot.slotId] = null
    }
  }

  // Eligibility conflict: bench-in can't fill some vacated slot. Try a single-step
  // swap: pick a returner who can play the unfilled slot AND whose vacated slot a
  // remaining bench-in player can fill.
  let unfilled = outfieldSlots.filter((s) => !result[s.slotId])
  while (unfilled.length > 0) {
    const target = unfilled[0]!
    let swapped = false
    for (const returnerSlot of outfieldSlots) {
      if (returnerSlot.slotId === target.slotId) continue
      const returnerId = result[returnerSlot.slotId]
      if (!returnerId) continue
      const returner = playersById.get(returnerId)
      if (!returner || !canPlayPosition(returner, target.positionTypeId)) continue
      const filler = outfieldPool.find(
        (p) => !usedPlayers.has(p.id) && canPlayPosition(p, returnerSlot.positionTypeId),
      )
      if (!filler) continue
      result[target.slotId] = returner.id
      result[returnerSlot.slotId] = filler.id
      usedPlayers.add(filler.id)
      break
    }
    swapped = !!result[target.slotId]
    if (!swapped) break
    unfilled = outfieldSlots.filter((s) => !result[s.slotId])
  }

  // Last-resort fallback: multi-hop conflict. Global augmenting match with continuity
  // preferences, accepting that several returners may shift.
  if (unfilled.length > 0 && outfieldPool.length >= outfieldSlots.length) {
    const fullMatch = maxMatch(outfieldSlots, outfieldPool, canPlayPosition, preferPlayerBySlot)
    for (const slot of outfieldSlots) {
      result[slot.slotId] = fullMatch.get(slot.slotId) ?? null
    }
  }
  return result
}
