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
  startBenchCount: number
  endBenchCount: number
  lastBenchedSeg: number
  keeperSegments: number
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
      startBenchCount: 0,
      endBenchCount: 0,
      lastBenchedSeg: -Infinity,
      keeperSegments: 0,
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

  for (const [matchIndex, matchSegments] of segmentsByMatch.entries()) {
    matchSegments.sort((a, b) => a.segmentIndex - b.segmentIndex)
    if (matchIndex !== lastKeeperMatchIndex) lastKeeperId = null

    // Reset per-match recent-bench history (cap/A3 do not bridge matches).
    for (const s of stats.values()) {
      s.lastBenchedSeg = -Infinity
    }
    consecBenchCount.clear()

    const firstSegIndex = matchSegments[0]!.segmentIndex
    const lastSegIndex = matchSegments[matchSegments.length - 1]!.segmentIndex

    const segsPerPeriod = new Map<number, Segment[]>()
    for (const s of matchSegments) {
      const arr = segsPerPeriod.get(s.periodIndex) ?? []
      arr.push(s)
      segsPerPeriod.set(s.periodIndex, arr)
    }

    let prevBench = new Set<string>()
    let prevPeriodIndex = -1
    let prevGkId: string | null = null

    for (const seg of matchSegments) {
      const isMatchStart = seg.segmentIndex === firstSegIndex
      const isMatchEnd = seg.segmentIndex === lastSegIndex
      const newPeriod = seg.periodIndex !== prevPeriodIndex
      const pin = pins[seg.segmentIndex] ?? {}

      const periodSegs = segsPerPeriod.get(seg.periodIndex) ?? []
      const idxInPeriod = periodSegs.findIndex((s) => s.segmentIndex === seg.segmentIndex)
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
        isMatchStart,
        isMatchEnd,
        isKeeperEligible,
        isL1,
        warnings,
      }

      if (isMidSegmentSwap && prevGkId && activeIds.has(prevGkId) && noPinOverride) {
        preBenchForMidSwap = pickBench({ ...benchArgs, forcedFieldIds: new Set([prevGkId]) })
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
          bench = active
            .filter((p) => !fieldSet.has(p.id) && p.id !== gkId)
            .map((p) => p.id)
            .slice(0, segBenchSpots)
        } else {
          bench = pickBench({ ...benchArgs, forcedFieldIds: gkId ? new Set([gkId]) : new Set() })
        }
      }

      const benchSet = new Set(bench)
      if (gkId && benchSet.has(gkId)) {
        benchSet.delete(gkId)
        bench = bench.filter((id) => id !== gkId)
        warnings.push({
          kind: 'lock-conflict',
          message: `Pin at match ${seg.matchIndex + 1} period ${seg.periodIndex + 1} placed keeper on bench; keeper kept on field.`,
        })
        // Bench shrunk by 1 — refill so on-field count stays exact.
        if (bench.length < segBenchSpots) {
          const fillCandidates = active
            .filter((p) => p.id !== gkId && !benchSet.has(p.id))
            .sort((a, b) => compareForBench(a, b, stats, isMatchStart, isMatchEnd))
          for (const p of fillCandidates) {
            if (bench.length >= segBenchSpots) break
            bench.push(p.id)
            benchSet.add(p.id)
          }
        }
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
      for (const id of creditedSet) {
        const s = stats.get(id)
        if (s) s.pitchCount++
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
  isMatchStart: boolean
  isMatchEnd: boolean
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
    isMatchStart,
    isMatchEnd,
    isKeeperEligible,
    isL1,
    forcedFieldIds,
    warnings,
  } = args

  if (benchSpots <= 0) return []

  // First segment of match (no prev bench): fairness-only pick.
  if (prevBench.size === 0) {
    return fairnessPick(active, benchSpots, forcedFieldIds, stats, isL1, isKeeperEligible, isMatchStart, isMatchEnd, warnings)
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
  fieldCandidates.sort((a, b) => compareForBench(a, b, stats, isMatchStart, isMatchEnd))

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
  for (const p of fieldCandidates) {
    if (newBenchAddition.length >= subOn.length) break
    if (isL1(p) && l1OnNewBench >= 1) continue
    if (isKeeperEligible(p) && totalKeeperEligible - keOnNewBench - 1 < 1) continue
    newBenchAddition.push(p.id)
    if (isL1(p)) l1OnNewBench++
    if (isKeeperEligible(p)) keOnNewBench++
  }

  // Relax keeper-eligible cap if short.
  if (newBenchAddition.length < subOn.length) {
    for (const p of fieldCandidates) {
      if (newBenchAddition.length >= subOn.length) break
      if (newBenchAddition.includes(p.id)) continue
      if (isL1(p) && l1OnNewBench >= 1) continue
      newBenchAddition.push(p.id)
      if (isL1(p)) l1OnNewBench++
    }
    if (newBenchAddition.length < subOn.length) {
      warnings.push({
        kind: 'keeper-unavailable',
        message: 'Bench picks would leave no keeper-eligible on field.',
      })
    }
  }
  // Relax L1 cap if still short.
  if (newBenchAddition.length < subOn.length) {
    for (const p of fieldCandidates) {
      if (newBenchAddition.length >= subOn.length) break
      if (newBenchAddition.includes(p.id)) continue
      newBenchAddition.push(p.id)
    }
    warnings.push({
      kind: 'l1-cap-infeasible',
      message: 'Forced to bench more than one top-level player at once.',
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
  isMatchStart: boolean,
  isMatchEnd: boolean,
  warnings: SchedulerWarning[],
): string[] {
  const candidates = active.filter((p) => !forcedFieldIds.has(p.id))
  const sorted = [...candidates].sort((a, b) => compareForBench(a, b, stats, isMatchStart, isMatchEnd))

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
