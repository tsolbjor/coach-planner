import { normalizePlayerLevel, type Player, type SegmentPin, type SportConfig } from '../types'
import type { Segment, SchedulerWarning } from './types'

export interface RotationSolverInput {
  sportConfig: SportConfig
  players: Player[]
  segments: Segment[]
  /** segmentIndex → user override */
  pins: Record<number, SegmentPin>
  /** Swap keeper with a benched player at the period midpoint */
  changeKeeperMidPeriod?: boolean
}

export interface RotationSolverResult {
  gkBySegment: (string | null)[]
  benchBySegment: string[][]
  fieldBySegment: string[][]
  /** segmentIndex → mid-segment swap info (only set for odd-segment-per-period mid swaps) */
  midSwapBySegment: Map<number, { atMinute: number; preGkId: string | null; preBenchIds: string[] }>
  warnings: SchedulerWarning[]
}

interface PlayerStats {
  benchCount: number
  pitchCount: number
  startBenchCount: number
  endBenchCount: number
  lastBenchedSeg: number
  keeperSegments: number
}

export function solveRotation(input: RotationSolverInput): RotationSolverResult {
  const { sportConfig, players, segments, pins, changeKeeperMidPeriod = false } = input
  const warnings: SchedulerWarning[] = []

  const gkBySegment: (string | null)[] = []
  const benchBySegment: string[][] = []
  const fieldBySegment: string[][] = []
  const midSwapBySegment = new Map<
    number,
    { atMinute: number; preGkId: string | null; preFieldIds: string[]; preBenchIds: string[] }
  >()

  if (players.length === 0 || segments.length === 0) {
    return { gkBySegment, benchBySegment, fieldBySegment, midSwapBySegment, warnings }
  }

  const keeperPositionTypeId = sportConfig.positionTypes.find((pt) => pt.isKeeper)?.id ?? null
  const isKeeperEligible = (p: Player) =>
    keeperPositionTypeId === null || !(p.excludedPositionTypeIds ?? []).includes(keeperPositionTypeId)
  const isL1 = (p: Player) => normalizePlayerLevel(p.level) === 1
  const playerById = new Map(players.map((p) => [p.id, p]))

  const stats = new Map<string, PlayerStats>()
  for (const p of players) {
    stats.set(p.id, {
      benchCount: 0,
      pitchCount: 0,
      startBenchCount: 0,
      endBenchCount: 0,
      lastBenchedSeg: -Infinity,
      keeperSegments: 0,
    })
  }

  const segmentsByMatch = new Map<number, Segment[]>()
  for (const seg of segments) {
    const arr = segmentsByMatch.get(seg.matchIndex) ?? []
    arr.push(seg)
    segmentsByMatch.set(seg.matchIndex, arr)
  }

  let lastKeeperId: string | null = null
  let lastKeeperMatchIndex = -1

  for (const [matchIndex, matchSegments] of segmentsByMatch.entries()) {
    matchSegments.sort((a, b) => a.segmentIndex - b.segmentIndex)
    if (matchIndex !== lastKeeperMatchIndex) lastKeeperId = null

    // Reset per-match recent-bench history (A3/A9 do not bridge matches)
    for (const s of stats.values()) {
      s.lastBenchedSeg = -Infinity
    }

    const firstSegIndex = matchSegments[0]!.segmentIndex
    const lastSegIndex = matchSegments[matchSegments.length - 1]!.segmentIndex

    // Find first-segment-index per period so we can detect mid-period boundaries.
    const segsPerPeriod = new Map<number, Segment[]>()
    for (const s of matchSegments) {
      const arr = segsPerPeriod.get(s.periodIndex) ?? []
      arr.push(s)
      segsPerPeriod.set(s.periodIndex, arr)
    }

    let prevBench = new Set<string>()
    let prevPrevBench = new Set<string>()
    let prevPeriodIndex = -1
    let prevGkId: string | null = null

    for (const seg of matchSegments) {
      const isMatchStart = seg.segmentIndex === firstSegIndex
      const isMatchEnd = seg.segmentIndex === lastSegIndex
      const newPeriod = seg.periodIndex !== prevPeriodIndex
      const pin = pins[seg.segmentIndex] ?? {}

      // Mid-period swap detection: segment whose index within period is the midpoint.
      const periodSegs = segsPerPeriod.get(seg.periodIndex) ?? []
      const idxInPeriod = periodSegs.findIndex((s) => s.segmentIndex === seg.segmentIndex)
      const isOddPeriod = periodSegs.length % 2 === 1
      // Even: swap cleanly at start of segs[len/2]. Odd: swap mid-segment at segs[floor(len/2)].
      const midIdx = Math.floor(periodSegs.length / 2)
      const isMidPeriodSwap =
        changeKeeperMidPeriod &&
        periodSegs.length >= 2 &&
        idxInPeriod === midIdx &&
        !newPeriod
      const isMidSegmentSwap = isMidPeriodSwap && isOddPeriod

      const absentSet = new Set([...(pin.absentIds ?? []), ...(pin.absentCreditedIds ?? [])])
      const creditedSet = new Set(pin.absentCreditedIds ?? [])
      const active = players.filter((p) => !absentSet.has(p.id))
      const activeIds = new Set(active.map((p) => p.id))
      const segBenchSpots = Math.max(0, active.length - sportConfig.totalOnField)

      // 1) Pick GK + bench.
      let gkId: string | null = null
      let bench: string[]
      let preBenchForMidSwap: string[] | null = null
      let midPeriodSwapApplied: { incoming: string; outgoing: string } | null = null
      const keeperCmp = (a: Player, b: Player) => {
        const ka = stats.get(a.id)?.keeperSegments ?? 0
        const kb = stats.get(b.id)?.keeperSegments ?? 0
        if (ka !== kb) return ka - kb
        return a.id < b.id ? -1 : 1
      }

      const noPinOverride =
        pin.gkId === undefined && !pin.benchIds && !pin.fieldIds

      if (
        isMidSegmentSwap &&
        prevGkId &&
        activeIds.has(prevGkId) &&
        noPinOverride
      ) {
        // ODD-segment mid-swap path: pick bench FIRST (normal rotation, forcing old
        // keeper to field), then pick incoming keeper FROM that bench. New keeper
        // was on FIELD last segment, subs ONTO bench at start of this segment, and
        // becomes keeper at the mid-segment swap.
        preBenchForMidSwap = pickBench({
          players: active,
          benchSpotsPerSeg: segBenchSpots,
          prevBench,
          prevPrevBench,
          stats,
          isMatchStart,
          isMatchEnd,
          isKeeperEligible,
          isL1,
          forcedFieldIds: new Set([prevGkId]),
          warnings,
        })
        const benchKeeperCandidates = preBenchForMidSwap
          .map((id) => playerById.get(id))
          .filter((p): p is Player => !!p && isKeeperEligible(p))
          .sort(keeperCmp)
        if (benchKeeperCandidates.length > 0) {
          gkId = benchKeeperCandidates[0]!.id
          midPeriodSwapApplied = { incoming: gkId, outgoing: prevGkId }
          // Post-swap bench: pre-bench minus incoming keeper, plus old keeper.
          bench = preBenchForMidSwap.filter((id) => id !== gkId)
          bench.push(prevGkId)
        } else {
          // No keeper-eligible on bench: fall back to continuity.
          gkId = prevGkId
          bench = preBenchForMidSwap
        }
      } else {
        if (pin.gkId !== undefined) {
          gkId = pin.gkId
          if (gkId && absentSet.has(gkId)) {
            warnings.push({
              kind: 'lock-conflict',
              message: `Pin at match ${seg.matchIndex + 1} period ${seg.periodIndex + 1} pins absent player as keeper; ignored.`,
            })
            gkId = null
          }
          if (gkId && !isKeeperEligible(playerById.get(gkId) ?? ({} as Player))) {
            warnings.push({
              kind: 'keeper-unavailable',
              message: `Pinned keeper is excluded from keeper position at match ${seg.matchIndex + 1} period ${seg.periodIndex + 1}.`,
            })
          }
        } else if (isMidPeriodSwap && !isOddPeriod && prevGkId && activeIds.has(prevGkId)) {
          // Even-segment mid-period swap: incoming keeper comes from prev bench (clean boundary).
          const benchCandidates = [...prevBench]
            .map((id) => playerById.get(id))
            .filter((p): p is Player => !!p && activeIds.has(p.id) && isKeeperEligible(p) && p.id !== prevGkId)
            .sort(keeperCmp)
          if (benchCandidates.length > 0) {
            gkId = benchCandidates[0]!.id
            midPeriodSwapApplied = { incoming: gkId, outgoing: prevGkId }
          } else {
            gkId = prevGkId
          }
        } else if (!newPeriod && prevGkId && activeIds.has(prevGkId)) {
          gkId = prevGkId
        } else if (keeperPositionTypeId) {
          gkId = pickKeeper(active, stats, lastKeeperId, isKeeperEligible)
          if (!gkId) {
            warnings.push({
              kind: 'keeper-unavailable',
              message: 'No keeper-eligible player available.',
            })
          }
        }

        // 2) Pick bench (for non-odd-mid-swap paths).
        if (pin.benchIds) {
          bench = [...pin.benchIds].filter((id) => activeIds.has(id))
        } else if (midPeriodSwapApplied) {
          // Even-case bench-swap: incoming leaves prev bench, outgoing takes that seat.
          bench = [...prevBench]
            .filter((id) => id !== midPeriodSwapApplied!.incoming && activeIds.has(id))
          bench.push(midPeriodSwapApplied.outgoing)
        } else if (pin.fieldIds) {
          const fieldSet = new Set(pin.fieldIds.filter((id) => activeIds.has(id)))
          bench = active
            .filter((p) => !fieldSet.has(p.id) && p.id !== gkId)
            .map((p) => p.id)
            .slice(0, segBenchSpots)
        } else {
          bench = pickBench({
            players: active,
            benchSpotsPerSeg: segBenchSpots,
            prevBench,
            prevPrevBench,
            stats,
            isMatchStart,
            isMatchEnd,
            isKeeperEligible,
            isL1,
            forcedFieldIds: gkId ? new Set([gkId]) : new Set(),
            warnings,
          })
        }
      }

      const benchSet = new Set(bench)
      // Resolve gk/bench conflict: if pin put gk on bench, drop them from bench.
      if (gkId && benchSet.has(gkId)) {
        benchSet.delete(gkId)
        bench = bench.filter((id) => id !== gkId)
        warnings.push({
          kind: 'lock-conflict',
          message: `Pin at match ${seg.matchIndex + 1} period ${seg.periodIndex + 1} placed keeper on bench; keeper kept on field.`,
        })
      }

      // 3) Field = active − gk − bench.
      const field = active
        .filter((p) => p.id !== gkId && !benchSet.has(p.id))
        .map((p) => p.id)

      // Record mid-segment swap (odd-segment-per-period case).
      if (isMidSegmentSwap && midPeriodSwapApplied && preBenchForMidSwap) {
        const periodStartMin = seg.periodIndex * sportConfig.periodDurationMinutes
        const midMin = periodStartMin + sportConfig.periodDurationMinutes / 2
        // Pre-state (first half of segment): outgoing keeper still GK; incoming
        // keeper benched as preparation; bench = pre-bench (chosen by normal
        // rotation, includes incoming); field = active − oldGk − pre-bench.
        const preFieldIds = active
          .filter((p) => p.id !== midPeriodSwapApplied!.outgoing && !preBenchForMidSwap!.includes(p.id))
          .map((p) => p.id)
        midSwapBySegment.set(seg.segmentIndex, {
          atMinute: Math.round(midMin * 10) / 10,
          preGkId: midPeriodSwapApplied.outgoing,
          preFieldIds,
          preBenchIds: [...preBenchForMidSwap],
        })
      }

      gkBySegment[seg.segmentIndex] = gkId
      benchBySegment[seg.segmentIndex] = bench
      fieldBySegment[seg.segmentIndex] = field

      // 4) Update stats.
      for (const id of bench) {
        const s = stats.get(id)
        if (!s) continue
        s.benchCount++
        if (isMatchStart) s.startBenchCount++
        if (isMatchEnd) s.endBenchCount++
        s.lastBenchedSeg = seg.segmentIndex
      }
      if (gkId) {
        const s = stats.get(gkId)
        if (s) {
          s.pitchCount++
          s.keeperSegments++
        }
      }
      for (const id of field) {
        const s = stats.get(id)
        if (s) s.pitchCount++
      }
      // Credited absent: pitchCount++ so fairness treats them as if they played.
      for (const id of creditedSet) {
        const s = stats.get(id)
        if (s) s.pitchCount++
      }

      prevPrevBench = prevBench
      prevBench = benchSet
      prevPeriodIndex = seg.periodIndex
      prevGkId = gkId
      if (gkId) {
        lastKeeperId = gkId
        lastKeeperMatchIndex = matchIndex
      }
    }
  }

  return { gkBySegment, benchBySegment, fieldBySegment, midSwapBySegment, warnings }
}

function pickKeeper(
  players: Player[],
  stats: Map<string, PlayerStats>,
  lastKeeperId: string | null,
  isEligible: (p: Player) => boolean,
): string | null {
  const eligible = players.filter(isEligible)
  if (eligible.length === 0) return null
  const sorted = [...eligible].sort((a, b) => {
    const ka = stats.get(a.id)?.keeperSegments ?? 0
    const kb = stats.get(b.id)?.keeperSegments ?? 0
    if (ka !== kb) return ka - kb
    const aWasLast = a.id === lastKeeperId ? 1 : 0
    const bWasLast = b.id === lastKeeperId ? 1 : 0
    if (aWasLast !== bWasLast) return aWasLast - bWasLast
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
  return sorted[0]!.id
}

interface PickBenchArgs {
  players: Player[]
  benchSpotsPerSeg: number
  prevBench: Set<string>
  prevPrevBench: Set<string>
  stats: Map<string, PlayerStats>
  isMatchStart: boolean
  isMatchEnd: boolean
  isKeeperEligible: (p: Player) => boolean
  isL1: (p: Player) => boolean
  forcedFieldIds: Set<string>
  warnings: SchedulerWarning[]
}

function pickBench(args: PickBenchArgs): string[] {
  const {
    players,
    benchSpotsPerSeg,
    prevBench,
    prevPrevBench,
    stats,
    isMatchStart,
    isMatchEnd,
    isKeeperEligible,
    isL1,
    forcedFieldIds,
    warnings,
  } = args

  if (benchSpotsPerSeg <= 0) return []

  const hardExcluded = new Set<string>([...prevBench, ...prevPrevBench, ...forcedFieldIds])
  let candidates = players.filter((p) => !hardExcluded.has(p.id))

  if (candidates.length < benchSpotsPerSeg) {
    candidates = players.filter((p) => !prevBench.has(p.id) && !forcedFieldIds.has(p.id))
    warnings.push({
      kind: 'bench-rotation-impossible',
      message: 'Could not honour 2-segment field minimum after returning from bench — schedule too tight.',
    })
  }
  if (candidates.length < benchSpotsPerSeg) {
    candidates = players.filter((p) => !forcedFieldIds.has(p.id))
    warnings.push({
      kind: 'bench-rotation-impossible',
      message: 'Could not avoid back-to-back bench — schedule too tight.',
    })
  }

  const sorted = [...candidates].sort((a, b) => compareForBench(a, b, stats, isMatchStart, isMatchEnd))

  const picked: string[] = []
  let l1Picked = 0
  let keeperEligibleAvailable = players.filter(isKeeperEligible).length

  for (const p of sorted) {
    if (picked.length >= benchSpotsPerSeg) break
    if (isL1(p) && l1Picked >= 1) continue
    if (isKeeperEligible(p) && keeperEligibleAvailable - 1 < 1) continue
    picked.push(p.id)
    if (isL1(p)) l1Picked++
    if (isKeeperEligible(p)) keeperEligibleAvailable--
  }

  if (picked.length < benchSpotsPerSeg) {
    for (const p of sorted) {
      if (picked.length >= benchSpotsPerSeg) break
      if (picked.includes(p.id)) continue
      if (isL1(p) && l1Picked >= 1) continue
      picked.push(p.id)
      if (isL1(p)) l1Picked++
    }
    if (picked.length < benchSpotsPerSeg) {
      warnings.push({
        kind: 'keeper-unavailable',
        message: 'Bench picks would leave no keeper-eligible player on field.',
      })
    }
  }
  if (picked.length < benchSpotsPerSeg) {
    for (const p of sorted) {
      if (picked.length >= benchSpotsPerSeg) break
      if (picked.includes(p.id)) continue
      picked.push(p.id)
    }
    warnings.push({
      kind: 'l1-cap-infeasible',
      message: 'Forced to bench more than one top-level player at once.',
    })
  }

  return picked
}

function compareForBench(
  a: Player,
  b: Player,
  stats: Map<string, PlayerStats>,
  isMatchStart: boolean,
  isMatchEnd: boolean,
): number {
  const sa = stats.get(a.id)!
  const sb = stats.get(b.id)!
  if (sa.pitchCount !== sb.pitchCount) return sb.pitchCount - sa.pitchCount
  if (sa.benchCount !== sb.benchCount) return sa.benchCount - sb.benchCount
  if (isMatchStart && sa.startBenchCount !== sb.startBenchCount) {
    return sa.startBenchCount - sb.startBenchCount
  }
  if (isMatchEnd && sa.endBenchCount !== sb.endBenchCount) {
    return sa.endBenchCount - sb.endBenchCount
  }
  if (sa.lastBenchedSeg !== sb.lastBenchedSeg) return sa.lastBenchedSeg - sb.lastBenchedSeg
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}
