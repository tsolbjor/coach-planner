import type { Player, SportConfig } from '../types'
import type { Segment, SchedulerWarning } from './types'

export interface KeeperPlanInput {
  sportConfig: SportConfig
  players: Player[]
  segments: Segment[]
  /** segmentIndex → locked keeper playerId (from locked TimeSlots) */
  lockedKeeper: Map<number, string | null>
}

export interface KeeperPlanResult {
  /** Key `${matchIndex}:${periodIndex}` → playerId who serves as keeper that whole period */
  keeperByPeriod: Map<string, string | null>
  warnings: SchedulerWarning[]
}

export function planKeepers(input: KeeperPlanInput): KeeperPlanResult {
  const { sportConfig, players, segments, lockedKeeper } = input
  const warnings: SchedulerWarning[] = []
  const keeperByPeriod = new Map<string, string | null>()

  const keeperPositionTypeId = sportConfig.positionTypes.find((pt) => pt.isKeeper)?.id ?? null
  if (!keeperPositionTypeId) {
    return { keeperByPeriod, warnings }
  }

  const eligiblePlayers = players.filter(
    (p) => !(p.excludedPositionTypeIds ?? []).includes(keeperPositionTypeId),
  )
  if (eligiblePlayers.length === 0) {
    warnings.push({
      kind: 'keeper-unavailable',
      message: 'No players are eligible for keeper.',
    })
    return { keeperByPeriod, warnings }
  }

  const segmentsByPeriod = new Map<string, Segment[]>()
  for (const seg of segments) {
    const key = `${seg.matchIndex}:${seg.periodIndex}`
    const arr = segmentsByPeriod.get(key) ?? []
    arr.push(seg)
    segmentsByPeriod.set(key, arr)
  }

  // Sort period keys by (matchIndex, periodIndex) so accumulators apply in order.
  const sortedKeys = [...segmentsByPeriod.keys()].sort((a, b) => {
    const [am, ap] = a.split(':').map(Number)
    const [bm, bp] = b.split(':').map(Number)
    return am! - bm! || ap! - bp!
  })

  const keeperSegmentsByPlayer = new Map<string, number>()
  let lastKeeperId: string | null = null
  let lastKeeperMatchIndex = -1

  for (const key of sortedKeys) {
    const periodSegs = segmentsByPeriod.get(key)!
    periodSegs.sort((a, b) => a.segmentIndex - b.segmentIndex)
    const matchIndex = periodSegs[0]!.matchIndex
    const periodIndex = periodSegs[0]!.periodIndex

    // Locks: if any segment in the period is locked with a specific keeper, that keeper governs.
    const lockedIds = new Set<string>()
    for (const seg of periodSegs) {
      const id = lockedKeeper.get(seg.segmentIndex)
      if (id) lockedIds.add(id)
    }
    if (lockedIds.size > 1) {
      warnings.push({
        kind: 'lock-conflict',
        message: `Locked slots disagree on keeper for match ${matchIndex + 1} period ${periodIndex + 1}.`,
      })
    }
    if (lockedIds.size >= 1) {
      const chosen = [...lockedIds][0]!
      keeperByPeriod.set(key, chosen)
      keeperSegmentsByPlayer.set(chosen, (keeperSegmentsByPlayer.get(chosen) ?? 0) + periodSegs.length)
      lastKeeperId = chosen
      lastKeeperMatchIndex = matchIndex
      continue
    }

    if (matchIndex !== lastKeeperMatchIndex) lastKeeperId = null

    const chosen = pickPeriodKeeper(eligiblePlayers, keeperSegmentsByPlayer, lastKeeperId)
    keeperByPeriod.set(key, chosen)
    if (chosen) {
      keeperSegmentsByPlayer.set(chosen, (keeperSegmentsByPlayer.get(chosen) ?? 0) + periodSegs.length)
    }
    lastKeeperId = chosen
    lastKeeperMatchIndex = matchIndex
  }

  return { keeperByPeriod, warnings }
}

function pickPeriodKeeper(
  eligible: Player[],
  keeperSegmentsByPlayer: Map<string, number>,
  lastKeeperId: string | null,
): string | null {
  if (eligible.length === 0) return null
  // Prefer keeper with fewest accumulated keeper segments; rotate off the immediately previous keeper.
  const sorted = [...eligible].sort((a, b) => {
    const ka = keeperSegmentsByPlayer.get(a.id) ?? 0
    const kb = keeperSegmentsByPlayer.get(b.id) ?? 0
    if (ka !== kb) return ka - kb
    // Slight preference: don't repeat the immediately previous keeper if we can avoid it.
    const aWasLast = a.id === lastKeeperId ? 1 : 0
    const bWasLast = b.id === lastKeeperId ? 1 : 0
    if (aWasLast !== bWasLast) return aWasLast - bWasLast
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
  return sorted[0]!.id
}
