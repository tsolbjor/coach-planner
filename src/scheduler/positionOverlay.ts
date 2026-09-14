import type { Player, SportConfig, TimeSlot } from '../types'
import type { Segment, SchedulerWarning } from './types'
import { canPlayPosition, maxMatch } from './maxMatch'

export interface PositionOverlayInput {
  sportConfig: SportConfig
  players: Player[]
  segments: Segment[]
  gkBySegment: (string | null)[]
  fieldBySegment: string[][]
  lockedSlots?: TimeSlot[]
}

export interface PositionOverlayResult {
  positionsBySegment: Map<number, Record<string, string | null>>
  warnings: SchedulerWarning[]
}

/**
 * Maps each segment's field+gk players onto lineup slots.
 *   Period start: balanced assignment — each player rotates through their
 *     relevant positions across periods/matches.
 *   Within period: continuity — returning players keep their previous slot.
 * Pure overlay; never affects rotation.
 */
export function buildPositionOverlay(input: PositionOverlayInput): PositionOverlayResult {
  const { sportConfig, players, segments, gkBySegment, fieldBySegment } = input
  const warnings: SchedulerWarning[] = []
  const positionsBySegment = new Map<number, Record<string, string | null>>()

  const keeperSlotId =
    sportConfig.lineupSlots.find((s) => {
      const pt = sportConfig.positionTypes.find((p) => p.id === s.positionTypeId)
      return pt?.isKeeper
    })?.slotId ?? null
  const outfieldSlots = sportConfig.lineupSlots.filter((s) => s.slotId !== keeperSlotId)
  const playersById = new Map(players.map((p) => [p.id, p]))

  // Tracks how often each player has STARTED a period at each positionTypeId.
  const startsByPlayer = new Map<string, Map<string, number>>()
  const bumpStart = (playerId: string, positionTypeId: string) => {
    const inner = startsByPlayer.get(playerId) ?? new Map<string, number>()
    inner.set(positionTypeId, (inner.get(positionTypeId) ?? 0) + 1)
    startsByPlayer.set(playerId, inner)
  }

  const sortedSegments = [...segments].sort((a, b) => a.segmentIndex - b.segmentIndex)
  let prevPositions: Record<string, string | null> | null = null
  let prevMatchIndex = -1
  let prevPeriodIndex = -1

  for (const seg of sortedSegments) {
    const samePeriod =
      seg.matchIndex === prevMatchIndex && seg.periodIndex === prevPeriodIndex
    if (seg.matchIndex !== prevMatchIndex) prevPositions = null

    const gkId = gkBySegment[seg.segmentIndex] ?? null
    const fieldIds = fieldBySegment[seg.segmentIndex] ?? []
    const outfieldPool = fieldIds
      .map((id) => playersById.get(id))
      .filter((p): p is Player => !!p)

    const positions: Record<string, string | null> = {}
    if (keeperSlotId) positions[keeperSlotId] = gkId

    const locked = input.lockedSlots?.[seg.segmentIndex]
    if (locked) {
      Object.assign(positions, locked.positions)
      if (!samePeriod) {
        for (const slot of outfieldSlots) {
          const pid = positions[slot.slotId]
          if (pid) bumpStart(pid, slot.positionTypeId)
        }
      }
    } else if (samePeriod && prevPositions) {
      const cont = assignWithContinuity(outfieldSlots, outfieldPool, prevPositions)
      for (const slot of outfieldSlots) positions[slot.slotId] = cont[slot.slotId] ?? null
    } else {
      const matched = balancedMatch(outfieldSlots, outfieldPool, startsByPlayer)
      for (const slot of outfieldSlots) {
        const pid = matched.get(slot.slotId) ?? null
        positions[slot.slotId] = pid
        if (pid) bumpStart(pid, slot.positionTypeId)
      }
    }

    const unfilledSlots = outfieldSlots.filter((slot) => !positions[slot.slotId])
    if (unfilledSlots.length > 0) {
      warnings.push({
        kind: 'position-unavailable',
        message: `Could not fill ${unfilledSlots.length} outfield position${unfilledSlots.length === 1 ? '' : 's'} at match ${seg.matchIndex + 1} period ${seg.periodIndex + 1} segment ${seg.segmentIndex + 1} with the current player eligibility.`,
      })
    }

    positionsBySegment.set(seg.segmentIndex, positions)
    prevPositions = positions
    prevMatchIndex = seg.matchIndex
    prevPeriodIndex = seg.periodIndex
  }

  return { positionsBySegment, warnings }
}

/**
 * Bipartite matching with per-slot candidate ordering by start-count for the
 * slot's positionTypeId (ascending). Ties broken by total starts (least used
 * overall, ascending) then by id. Uses DFS augmenting paths like maxMatch but
 * with weighted candidate lists, so under-rotated player/position pairs are
 * picked first.
 */
function balancedMatch(
  slots: { slotId: string; positionTypeId: string; label: string }[],
  players: Player[],
  startsByPlayer: Map<string, Map<string, number>>,
): Map<string, string> {
  const candidatesBySlot = new Map<string, Player[]>()
  const totalStarts = (id: string) => {
    let total = 0
    const inner = startsByPlayer.get(id)
    if (!inner) return 0
    for (const v of inner.values()) total += v
    return total
  }
  for (const slot of slots) {
    const eligible = players.filter((p) => canPlayPosition(p, slot.positionTypeId))
    eligible.sort((a, b) => {
      const ca = startsByPlayer.get(a.id)?.get(slot.positionTypeId) ?? 0
      const cb = startsByPlayer.get(b.id)?.get(slot.positionTypeId) ?? 0
      if (ca !== cb) return ca - cb
      const ta = totalStarts(a.id)
      const tb = totalStarts(b.id)
      if (ta !== tb) return ta - tb
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    })
    candidatesBySlot.set(slot.slotId, eligible)
  }

  const matchedSlotByPlayer = new Map<string, string>()
  const matchedPlayerBySlot = new Map<string, string>()

  const assign = (slotId: string, visited: Set<string>): boolean => {
    const cands = candidatesBySlot.get(slotId) ?? []
    for (const player of cands) {
      if (visited.has(player.id)) continue
      visited.add(player.id)
      const cur = matchedSlotByPlayer.get(player.id)
      if (!cur || assign(cur, visited)) {
        matchedSlotByPlayer.set(player.id, slotId)
        matchedPlayerBySlot.set(slotId, player.id)
        return true
      }
    }
    return false
  }

  // Process tightest slots first (fewest eligible candidates).
  const slotOrder = [...slots].sort(
    (a, b) => (candidatesBySlot.get(a.slotId)?.length ?? 0) - (candidatesBySlot.get(b.slotId)?.length ?? 0),
  )
  for (const slot of slotOrder) assign(slot.slotId, new Set<string>())
  return matchedPlayerBySlot
}

function assignWithContinuity(
  outfieldSlots: { slotId: string; positionTypeId: string; label: string }[],
  outfieldPool: Player[],
  prevPositions: Record<string, string | null>,
): Record<string, string | null> {
  const result: Record<string, string | null> = {}
  const playersById = new Map(outfieldPool.map((p) => [p.id, p]))
  const usedPlayers = new Set<string>()
  const vacatedSlots: typeof outfieldSlots = []
  const preferPlayerBySlot = new Map<string, string>()

  for (const slot of outfieldSlots) {
    const prevPlayerId = prevPositions[slot.slotId] ?? null
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

  let unfilled = outfieldSlots.filter((s) => !result[s.slotId])
  while (unfilled.length > 0) {
    const target = unfilled[0]!
    let filled = false
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
      filled = true
      break
    }
    if (!filled) break
    unfilled = outfieldSlots.filter((s) => !result[s.slotId])
  }

  if (unfilled.length > 0 && outfieldPool.length >= outfieldSlots.length) {
    const fullMatch = maxMatch(outfieldSlots, outfieldPool, canPlayPosition, preferPlayerBySlot)
    for (const slot of outfieldSlots) result[slot.slotId] = fullMatch.get(slot.slotId) ?? null
  }
  return result
}
