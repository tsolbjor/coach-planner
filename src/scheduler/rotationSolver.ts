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
  /** Max consecutive segments a player can be on the bench (default 1). */
  maxBenchSegments?: number
  /** Min substitutions per segment boundary (default 0). */
  minSubsPerSegment?: number
  /** Max substitutions per segment boundary (default unlimited within bench size). */
  maxSubsPerSegment?: number
}

export interface RotationSolverResult {
  gkBySegment: (string | null)[]
  benchBySegment: string[][]
  fieldBySegment: string[][]
  /** segmentIndex → mid-segment swap info (only set for odd-segment-per-period mid swaps) */
  midSwapBySegment: Map<number, { atMinute: number; preGkId: string | null; preFieldIds: string[]; preBenchIds: string[] }>
  warnings: SchedulerWarning[]
}

interface PlayerStats {
  benchCount: number
  pitchCount: number
  periodStartBenchCount: number
  periodEndBenchCount: number
  lastBenchedSeg: number
  keeperSegments: number
  consecutiveOnFieldSegments: number
}

export function solveRotation(input: RotationSolverInput): RotationSolverResult {
  const {
    sportConfig,
    players,
    segments,
    pins,
    changeKeeperMidPeriod = false,
    maxBenchSegments = 1,
    minSubsPerSegment = 0,
    maxSubsPerSegment = Number.POSITIVE_INFINITY,
  } = input
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
      periodStartBenchCount: 0,
      periodEndBenchCount: 0,
      lastBenchedSeg: -Infinity,
      keeperSegments: 0,
      consecutiveOnFieldSegments: 0,
    })
  }

  const consecBenchCount = new Map<string, number>()

  const segmentsByMatch = new Map<number, Segment[]>()
  for (const seg of segments) {
    const arr = segmentsByMatch.get(seg.matchIndex) ?? []
    arr.push(seg)
    segmentsByMatch.set(seg.matchIndex, arr)
  }

  let lastKeeperId: string | null = null
  let lastKeeperMatchIndex = -1
  let mustPlayNextBoundary = new Set<string>()

  for (const [matchIndex, matchSegments] of segmentsByMatch.entries()) {
    matchSegments.sort((a, b) => a.segmentIndex - b.segmentIndex)
    if (matchIndex !== lastKeeperMatchIndex) lastKeeperId = null

    // Reset per-match recent-bench history (cap/A3 do not bridge matches).
    for (const s of stats.values()) {
      s.lastBenchedSeg = -Infinity
    }
    consecBenchCount.clear()

    const segsPerPeriod = new Map<number, Segment[]>()
    for (const s of matchSegments) {
      const arr = segsPerPeriod.get(s.periodIndex) ?? []
      arr.push(s)
      segsPerPeriod.set(s.periodIndex, arr)
    }

    let prevBench = new Set<string>()
    let prevPeriodIndex = -1
    let prevGkId: string | null = null
    const lastMatchSegmentIndex = matchSegments[matchSegments.length - 1]!.segmentIndex

    for (const seg of matchSegments) {
      const newPeriod = seg.periodIndex !== prevPeriodIndex
      const isPeriodStart = newPeriod
      const pin = pins[seg.segmentIndex] ?? {}

      const periodSegs = segsPerPeriod.get(seg.periodIndex) ?? []
      const idxInPeriod = periodSegs.findIndex((s) => s.segmentIndex === seg.segmentIndex)
      const isPeriodEnd = idxInPeriod === periodSegs.length - 1
      const isMatchEnd = seg.segmentIndex === lastMatchSegmentIndex
      const isOddPeriod = periodSegs.length % 2 === 1
      const midIdx = Math.floor(periodSegs.length / 2)
      const isMidPeriodSwap =
        changeKeeperMidPeriod && periodSegs.length >= 2 && idxInPeriod === midIdx && !newPeriod
      const isMidSegmentSwap = isMidPeriodSwap && isOddPeriod

      const absentSet = new Set([...(pin.absentIds ?? []), ...(pin.absentCreditedIds ?? [])])
      const creditedSet = new Set(pin.absentCreditedIds ?? [])
      const active = players.filter((p) => !absentSet.has(p.id))
      const activeIds = new Set(active.map((p) => p.id))
      const segBenchSpots = Math.max(0, active.length - sportConfig.totalOnField)
      const boundaryCarryOverFieldIds = isPeriodStart
        ? new Set([...mustPlayNextBoundary].filter((id) => activeIds.has(id)))
        : new Set<string>()

      let gkId: string | null = null
      let bench: string[]
      let pinnedFieldIds = new Set<string>()
      let preBenchForMidSwap: string[] | null = null
      let midPeriodSwapApplied: { incoming: string; outgoing: string } | null = null
      const keeperCmp = (a: Player, b: Player) => {
        const ka = stats.get(a.id)?.keeperSegments ?? 0
        const kb = stats.get(b.id)?.keeperSegments ?? 0
        if (ka !== kb) return ka - kb
        return a.id < b.id ? -1 : 1
      }

      const noPinOverride = pin.gkId === undefined && !pin.benchIds && !pin.fieldIds

      const benchArgs = {
        active,
        benchSpots: segBenchSpots,
        prevBench,
        consecBenchCount,
        maxBenchSegments,
        minSubsPerSegment,
        maxSubsPerSegment,
        stats,
        isBoundaryStart: isPeriodStart,
        isBoundaryEnd: isPeriodEnd,
        isKeeperEligible,
        isL1,
        warnings,
      }

      if (isMidSegmentSwap && prevGkId && activeIds.has(prevGkId) && noPinOverride) {
        preBenchForMidSwap = pickBench({
          ...benchArgs,
          forcedFieldIds: new Set([prevGkId, ...boundaryCarryOverFieldIds]),
        })
        const benchKeeperCandidates = preBenchForMidSwap
          .map((id) => playerById.get(id))
          .filter((p): p is Player => !!p && isKeeperEligible(p))
          .sort(keeperCmp)
        if (benchKeeperCandidates.length > 0) {
          gkId = benchKeeperCandidates[0]!.id
          midPeriodSwapApplied = { incoming: gkId, outgoing: prevGkId }
          bench = preBenchForMidSwap.filter((id) => id !== gkId)
          bench.push(prevGkId)
        } else {
          gkId = prevGkId
          bench = preBenchForMidSwap
          warnings.push({
            kind: 'keeper-unavailable',
            message: `Keeper mid-period swap skipped at match ${seg.matchIndex + 1} period ${seg.periodIndex + 1}; no bench keeper was available.`,
          })
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
          const benchCandidates = [...prevBench]
            .map((id) => playerById.get(id))
            .filter((p): p is Player => !!p && activeIds.has(p.id) && isKeeperEligible(p) && p.id !== prevGkId)
            .sort(keeperCmp)
          if (benchCandidates.length > 0) {
            gkId = benchCandidates[0]!.id
            midPeriodSwapApplied = { incoming: gkId, outgoing: prevGkId }
          } else {
            gkId = prevGkId
            warnings.push({
              kind: 'keeper-unavailable',
              message: `Keeper mid-period swap skipped at match ${seg.matchIndex + 1} period ${seg.periodIndex + 1}; no bench keeper was available.`,
            })
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

        if (pin.benchIds) {
          bench = [...pin.benchIds].filter((id) => activeIds.has(id))
        } else if (midPeriodSwapApplied) {
          bench = [...prevBench].filter((id) => id !== midPeriodSwapApplied!.incoming && activeIds.has(id))
          bench.push(midPeriodSwapApplied.outgoing)
        } else if (pin.fieldIds) {
          const fieldSet = new Set(pin.fieldIds.filter((id) => activeIds.has(id)))
          pinnedFieldIds = fieldSet
          bench = active
            .filter((p) => !fieldSet.has(p.id) && p.id !== gkId)
            .map((p) => p.id)
            .slice(0, segBenchSpots)
        } else {
          bench = pickBench({
            ...benchArgs,
            forcedFieldIds: new Set([...(gkId ? [gkId] : []), ...boundaryCarryOverFieldIds]),
          })
        }
      }

      const rawBenchHadKeeper = !!gkId && bench.includes(gkId)
      if (rawBenchHadKeeper) {
        warnings.push({
          kind: 'lock-conflict',
          message: `Pin at match ${seg.matchIndex + 1} period ${seg.periodIndex + 1} placed keeper on bench; keeper kept on field.`,
        })
      }

      const normalizedBench = normalizeBench({
        bench,
        active,
        gkId,
        benchSpots: segBenchSpots,
        forcedFieldIds: boundaryCarryOverFieldIds,
        pinnedFieldIds,
        stats,
        isBoundaryStart: isPeriodStart,
        isBoundaryEnd: isPeriodEnd,
        warnings,
        segmentLabel: `match ${seg.matchIndex + 1} period ${seg.periodIndex + 1}`,
        hadExactBenchPin: !!pin.benchIds,
      })
      bench = normalizedBench

      const benchSet = new Set(bench)
      if (gkId && benchSet.has(gkId)) {
        benchSet.delete(gkId)
        bench = bench.filter((id) => id !== gkId)
        bench = normalizeBench({
          bench,
          active,
          gkId,
          benchSpots: segBenchSpots,
          forcedFieldIds: boundaryCarryOverFieldIds,
          pinnedFieldIds,
          stats,
          isBoundaryStart: isPeriodStart,
          isBoundaryEnd: isPeriodEnd,
          warnings,
          segmentLabel: `match ${seg.matchIndex + 1} period ${seg.periodIndex + 1}`,
          hadExactBenchPin: !!pin.benchIds,
        })
        benchSet.clear()
        for (const id of bench) benchSet.add(id)
      }

      const field = active.filter((p) => p.id !== gkId && !benchSet.has(p.id)).map((p) => p.id)

      if (isMidSegmentSwap && midPeriodSwapApplied && preBenchForMidSwap) {
        const periodStartMin = seg.periodIndex * sportConfig.periodDurationMinutes
        const midMin = periodStartMin + sportConfig.periodDurationMinutes / 2
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

      for (const id of bench) {
        const s = stats.get(id)
        if (!s) continue
        s.benchCount++
        if (isPeriodStart) s.periodStartBenchCount++
        if (isPeriodEnd) s.periodEndBenchCount++
        s.lastBenchedSeg = seg.segmentIndex
      }
      const pitchCredit = new Map<string, number>()
      const keeperCredit = new Map<string, number>()
      if (isMidSegmentSwap && midPeriodSwapApplied && preBenchForMidSwap) {
        const preFieldIds = active
          .filter((p) => p.id !== midPeriodSwapApplied.outgoing && !preBenchForMidSwap.includes(p.id))
          .map((p) => p.id)
        addCredits(pitchCredit, keeperCredit, midPeriodSwapApplied.outgoing, preFieldIds, 0.5)
        addCredits(pitchCredit, keeperCredit, gkId, field, 0.5)
      } else {
        addCredits(pitchCredit, keeperCredit, gkId, field, 1)
      }
      for (const [id, credit] of pitchCredit.entries()) {
        const s = stats.get(id)
        if (s) s.pitchCount += credit
      }
      for (const [id, credit] of keeperCredit.entries()) {
        const s = stats.get(id)
        if (s) s.keeperSegments += credit
      }
      for (const id of creditedSet) {
        const s = stats.get(id)
        if (s) s.pitchCount++
      }

      const onFieldSet = new Set([...(gkId ? [gkId] : []), ...field])
      for (const p of players) {
        const s = stats.get(p.id)
        if (!s) continue
        if (onFieldSet.has(p.id)) s.consecutiveOnFieldSegments += 1
        else s.consecutiveOnFieldSegments = 0
      }

      // Update consecutive-bench counter.
      for (const p of players) {
        if (benchSet.has(p.id)) {
          consecBenchCount.set(p.id, (consecBenchCount.get(p.id) ?? 0) + (prevBench.has(p.id) ? 1 : 1))
          // Note: if was bench last seg (in prevBench) AND now → count = prev+1; first time → 1.
          if (!prevBench.has(p.id)) consecBenchCount.set(p.id, 1)
        } else {
          consecBenchCount.set(p.id, 0)
        }
      }

      prevBench = benchSet
      prevPeriodIndex = seg.periodIndex
      prevGkId = gkId
      if (isPeriodEnd || isMatchEnd) {
        mustPlayNextBoundary = new Set(bench)
      } else if (isPeriodStart && mustPlayNextBoundary.size > 0) {
        mustPlayNextBoundary = new Set()
      }
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
  active: Player[]
  benchSpots: number
  prevBench: Set<string>
  consecBenchCount: Map<string, number>
  maxBenchSegments: number
  minSubsPerSegment: number
  maxSubsPerSegment: number
  stats: Map<string, PlayerStats>
  isBoundaryStart: boolean
  isBoundaryEnd: boolean
  isKeeperEligible: (p: Player) => boolean
  isL1: (p: Player) => boolean
  forcedFieldIds: Set<string>
  warnings: SchedulerWarning[]
}

function pickBench(args: PickBenchArgs): string[] {
  const {
    active,
    benchSpots,
    prevBench,
    consecBenchCount,
    maxBenchSegments,
    minSubsPerSegment,
    maxSubsPerSegment,
    stats,
    isBoundaryStart,
    isBoundaryEnd,
    isKeeperEligible,
    isL1,
    forcedFieldIds,
    warnings,
  } = args

  if (benchSpots <= 0) return []

  // First segment of match (no prev bench): fairness-only pick.
  if (prevBench.size === 0) {
    return fairnessPick(active, benchSpots, forcedFieldIds, stats, isL1, isKeeperEligible, isBoundaryStart, isBoundaryEnd, warnings)
  }

  const activeIds = new Set(active.map((p) => p.id))

  // Capped: prev bench players whose consecutive-bench would exceed maxBenchSegments if benched again.
  const cappedOffBench = [...prevBench].filter((id) => {
    if (forcedFieldIds.has(id)) return false
    if (!activeIds.has(id)) return false
    return (consecBenchCount.get(id) ?? 0) >= maxBenchSegments
  })

  const maxSubsEff = Math.min(maxSubsPerSegment, benchSpots)
  const minSubsEff = Math.max(0, Math.min(minSubsPerSegment, maxSubsEff))
  let targetSubs = Math.max(minSubsEff, cappedOffBench.length)
  if (cappedOffBench.length > maxSubsEff) {
    warnings.push({
      kind: 'bench-rotation-impossible',
      message: 'Max subs per segment too low to honour bench cap.',
    })
    targetSubs = cappedOffBench.length
  }
  targetSubs = Math.min(targetSubs, benchSpots)

  // Players coming OFF bench: capped first, then more by least-pitch (need pitch).
  const subOn: string[] = [...cappedOffBench]
  const benchRemaining = [...prevBench]
    .filter((id) => !subOn.includes(id) && !forcedFieldIds.has(id) && activeIds.has(id))
    .sort((a, b) => (stats.get(a)?.pitchCount ?? 0) - (stats.get(b)?.pitchCount ?? 0))
  while (subOn.length < targetSubs && benchRemaining.length > 0) {
    subOn.push(benchRemaining.shift()!)
  }

  const stayedBench = [...prevBench].filter((id) => !subOn.includes(id) && activeIds.has(id))

  // Players coming OFF field to bench. From prev field (= active not in prevBench), excluding forced-field.
  const fieldCandidates = active.filter(
    (p) => !prevBench.has(p.id) && !forcedFieldIds.has(p.id),
  )
  fieldCandidates.sort((a, b) => compareForBench(a, b, stats, isBoundaryStart, isBoundaryEnd))
  const protectedRecentReturners = fieldCandidates.filter(
    (p) => (stats.get(p.id)?.consecutiveOnFieldSegments ?? 0) <= 1,
  )
  const preferredFieldCandidates = fieldCandidates.filter(
    (p) => (stats.get(p.id)?.consecutiveOnFieldSegments ?? 0) > 1,
  )

  const totalKeeperEligible = active.filter(isKeeperEligible).length
  let keOnNewBench = stayedBench.filter((id) => {
    const p = active.find((pp) => pp.id === id)
    return p && isKeeperEligible(p)
  }).length
  let l1OnNewBench = stayedBench.filter((id) => {
    const p = active.find((pp) => pp.id === id)
    return p && isL1(p)
  }).length

  const newBenchAddition: string[] = []
  const tryAddCandidates = (
    candidates: Player[],
    opts: { respectL1Cap: boolean; respectKeeperCap: boolean },
  ) => {
    for (const p of candidates) {
      if (newBenchAddition.length >= subOn.length) break
      if (newBenchAddition.includes(p.id)) continue
      if (opts.respectL1Cap && isL1(p) && l1OnNewBench >= 1) continue
      if (
        opts.respectKeeperCap &&
        isKeeperEligible(p) &&
        totalKeeperEligible - keOnNewBench - 1 < 1
      ) continue
      newBenchAddition.push(p.id)
      if (isL1(p)) l1OnNewBench++
      if (isKeeperEligible(p)) keOnNewBench++
    }
  }

  tryAddCandidates(preferredFieldCandidates, { respectL1Cap: true, respectKeeperCap: true })
  tryAddCandidates(protectedRecentReturners, { respectL1Cap: true, respectKeeperCap: true })
  tryAddCandidates(preferredFieldCandidates, { respectL1Cap: true, respectKeeperCap: false })
  tryAddCandidates(protectedRecentReturners, { respectL1Cap: true, respectKeeperCap: false })
  // Relax L1 cap if still short.
  if (newBenchAddition.length < subOn.length) {
    for (const p of fieldCandidates) {
      if (newBenchAddition.length >= subOn.length) break
      if (newBenchAddition.includes(p.id)) continue
      newBenchAddition.push(p.id)
      if (isKeeperEligible(p)) keOnNewBench++
    }
    warnings.push({
      kind: 'l1-cap-infeasible',
      message: 'Forced to bench more than one top-level player at once.',
    })
  }
  if (totalKeeperEligible - keOnNewBench < 1) {
    warnings.push({
      kind: 'keeper-unavailable',
      message: 'Bench picks would leave no keeper-eligible on field.',
    })
  }

  return [...stayedBench, ...newBenchAddition]
}

function fairnessPick(
  active: Player[],
  benchSpots: number,
  forcedFieldIds: Set<string>,
  stats: Map<string, PlayerStats>,
  isL1: (p: Player) => boolean,
  isKeeperEligible: (p: Player) => boolean,
  isBoundaryStart: boolean,
  isBoundaryEnd: boolean,
  warnings: SchedulerWarning[],
): string[] {
  const candidates = active.filter((p) => !forcedFieldIds.has(p.id))
  const sorted = [...candidates].sort((a, b) => compareForBench(a, b, stats, isBoundaryStart, isBoundaryEnd))

  const totalKE = active.filter(isKeeperEligible).length
  let keOnBench = 0
  let l1Picked = 0
  const picked: string[] = []

  for (const p of sorted) {
    if (picked.length >= benchSpots) break
    if (isL1(p) && l1Picked >= 1) continue
    if (isKeeperEligible(p) && totalKE - keOnBench - 1 < 1) continue
    picked.push(p.id)
    if (isL1(p)) l1Picked++
    if (isKeeperEligible(p)) keOnBench++
  }
  if (picked.length < benchSpots) {
    for (const p of sorted) {
      if (picked.length >= benchSpots) break
      if (picked.includes(p.id)) continue
      if (isL1(p) && l1Picked >= 1) continue
      picked.push(p.id)
      if (isL1(p)) l1Picked++
    }
    if (picked.length < benchSpots) {
      warnings.push({
        kind: 'keeper-unavailable',
        message: 'Bench picks would leave no keeper-eligible on field.',
      })
    }
  }
  if (picked.length < benchSpots) {
    for (const p of sorted) {
      if (picked.length >= benchSpots) break
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
  isBoundaryStart: boolean,
  isBoundaryEnd: boolean,
): number {
  const sa = stats.get(a.id)!
  const sb = stats.get(b.id)!
  if (sa.consecutiveOnFieldSegments !== sb.consecutiveOnFieldSegments) {
    return sb.consecutiveOnFieldSegments - sa.consecutiveOnFieldSegments
  }
  if (sa.pitchCount !== sb.pitchCount) return sb.pitchCount - sa.pitchCount
  if (sa.benchCount !== sb.benchCount) return sa.benchCount - sb.benchCount
  if (isBoundaryStart && sa.periodStartBenchCount !== sb.periodStartBenchCount) {
    return sa.periodStartBenchCount - sb.periodStartBenchCount
  }
  if (isBoundaryEnd && sa.periodEndBenchCount !== sb.periodEndBenchCount) {
    return sa.periodEndBenchCount - sb.periodEndBenchCount
  }
  if (sa.lastBenchedSeg !== sb.lastBenchedSeg) return sa.lastBenchedSeg - sb.lastBenchedSeg
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

function normalizeBench(args: {
  bench: string[]
  active: Player[]
  gkId: string | null
  benchSpots: number
  forcedFieldIds: Set<string>
  pinnedFieldIds: Set<string>
  stats: Map<string, PlayerStats>
  isBoundaryStart: boolean
  isBoundaryEnd: boolean
  warnings: SchedulerWarning[]
  segmentLabel: string
  hadExactBenchPin: boolean
}): string[] {
  const {
    bench,
    active,
    gkId,
    benchSpots,
    forcedFieldIds,
    pinnedFieldIds,
    stats,
    isBoundaryStart,
    isBoundaryEnd,
    warnings,
    segmentLabel,
    hadExactBenchPin,
  } = args
  const activeIds = new Set(active.map((p) => p.id))
  const nextBench: string[] = []
  const seen = new Set<string>()
  const originalBenchLength = bench.length

  for (const id of bench) {
    if (
      id === gkId ||
      forcedFieldIds.has(id) ||
      pinnedFieldIds.has(id) ||
      !activeIds.has(id) ||
      seen.has(id)
    ) continue
    seen.add(id)
    nextBench.push(id)
  }

  if (hadExactBenchPin && nextBench.length < originalBenchLength) {
    warnings.push({
      kind: 'lock-conflict',
      message: `Pin at ${segmentLabel} could not keep every requested bench player and was adjusted to preserve the lineup rules.`,
    })
  }

  if (nextBench.length > benchSpots) {
    if (hadExactBenchPin && nextBench.length === originalBenchLength) {
      warnings.push({
        kind: 'lock-conflict',
        message: `Pin at ${segmentLabel} benches more active players than possible; trimmed to keep a full lineup.`,
      })
    }
    nextBench.splice(benchSpots)
    seen.clear()
    for (const id of nextBench) seen.add(id)
  }

  if (nextBench.length < benchSpots) {
    const fillCandidates = active
      .filter((p) => p.id !== gkId && !seen.has(p.id))
      .sort((a, b) => compareForBench(a, b, stats, isBoundaryStart, isBoundaryEnd))
    for (const p of fillCandidates) {
      if (nextBench.length >= benchSpots) break
        if (forcedFieldIds.has(p.id) || pinnedFieldIds.has(p.id)) continue
        nextBench.push(p.id)
        seen.add(p.id)
      }
  }

  if (nextBench.length < benchSpots) {
    const forcedFill = active
      .filter(
        (p) => p.id !== gkId && !seen.has(p.id) && forcedFieldIds.has(p.id) && !pinnedFieldIds.has(p.id),
      )
      .sort((a, b) => compareForBench(a, b, stats, isBoundaryStart, isBoundaryEnd))
    for (const p of forcedFill) {
      if (nextBench.length >= benchSpots) break
      nextBench.push(p.id)
      seen.add(p.id)
    }
    if (forcedFill.length > 0) {
      warnings.push({
        kind: 'lock-conflict',
        message: `Pin at ${segmentLabel} relaxed a boundary carry-over preference to preserve exact on-field count.`,
      })
    }
  }

  if (nextBench.length < benchSpots) {
    const relaxedPinFill = active
      .filter((p) => p.id !== gkId && !seen.has(p.id))
      .sort((a, b) => compareForBench(a, b, stats, isBoundaryStart, isBoundaryEnd))
    let usedPinnedField = false
    for (const p of relaxedPinFill) {
      if (nextBench.length >= benchSpots) break
      if (forcedFieldIds.has(p.id)) continue
      if (pinnedFieldIds.has(p.id)) usedPinnedField = true
      nextBench.push(p.id)
      seen.add(p.id)
    }
    if (usedPinnedField) {
      warnings.push({
        kind: 'lock-conflict',
        message: `Pin at ${segmentLabel} relaxed a field pin to preserve exact on-field count.`,
      })
    }
  }

  return nextBench
}

function addCredits(
  pitchCredit: Map<string, number>,
  keeperCredit: Map<string, number>,
  gkId: string | null,
  fieldIds: string[],
  credit: number,
) {
  if (credit <= 0) return
  if (gkId) {
    pitchCredit.set(gkId, (pitchCredit.get(gkId) ?? 0) + credit)
    keeperCredit.set(gkId, (keeperCredit.get(gkId) ?? 0) + credit)
  }
  for (const id of fieldIds) {
    pitchCredit.set(id, (pitchCredit.get(id) ?? 0) + credit)
  }
}
