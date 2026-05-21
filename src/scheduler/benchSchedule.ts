import { normalizePlayerLevel, type Player, type SportConfig } from '../types'
import type { Segment, SchedulerWarning } from './types'

export interface LockedBench {
  /** Bench player ids exactly as locked */
  bench: string[]
  /** Field player ids (everyone in locked.assignments) */
  field: Set<string>
}

export interface BenchScheduleInput {
  sportConfig: SportConfig
  players: Player[]
  segments: Segment[]
  /** segmentIndex → locked bench composition (only present for locked segments) */
  locks: Map<number, LockedBench>
  /** segmentIndex → playerIds that must remain on field (e.g. designated keeper) */
  forcedField?: Map<number, Set<string>>
}

export interface BenchScheduleResult {
  /** segmentIndex → ordered bench player ids */
  benchBySegment: string[][]
  /** Per-player total bench-segment count across the plan */
  benchCountByPlayer: Map<string, number>
  warnings: SchedulerWarning[]
}

interface PlayerStats {
  benchCount: number
  /** Total segments where player was on the field (incl. keeper) — used to balance pitch time */
  pitchCount: number
  startBenchCount: number
  endBenchCount: number
  /** Last segmentIndex within current match where player was benched, -∞ if none */
  lastBenchedSeg: number
}

export function scheduleBench(input: BenchScheduleInput): BenchScheduleResult {
  const { sportConfig, players, segments, locks, forcedField } = input
  const warnings: SchedulerWarning[] = []
  const benchBySegment: string[][] = []

  if (players.length === 0 || segments.length === 0) {
    return { benchBySegment: segments.map(() => []), benchCountByPlayer: new Map(), warnings }
  }

  const benchSpotsPerSeg = Math.max(0, players.length - sportConfig.totalOnField)
  const keeperPositionTypeId = sportConfig.positionTypes.find((pt) => pt.isKeeper)?.id ?? null
  const isKeeperEligible = (p: Player) =>
    keeperPositionTypeId === null || !(p.excludedPositionTypeIds ?? []).includes(keeperPositionTypeId)
  const isL1 = (p: Player) => normalizePlayerLevel(p.level) === 1

  const stats = new Map<string, PlayerStats>()
  for (const p of players) {
    stats.set(p.id, {
      benchCount: 0,
      pitchCount: 0,
      startBenchCount: 0,
      endBenchCount: 0,
      lastBenchedSeg: -Infinity,
    })
  }

  const segmentsByMatch = new Map<number, Segment[]>()
  for (const seg of segments) {
    const arr = segmentsByMatch.get(seg.matchIndex) ?? []
    arr.push(seg)
    segmentsByMatch.set(seg.matchIndex, arr)
  }

  for (const [matchIndex, matchSegments] of segmentsByMatch.entries()) {
    matchSegments.sort((a, b) => a.segmentIndex - b.segmentIndex)
    // Reset per-match recent-bench history (A3/A9 do not bridge matches)
    for (const s of stats.values()) {
      s.lastBenchedSeg = -Infinity
    }

    const lastSegIndex = matchSegments[matchSegments.length - 1]!.segmentIndex
    const firstSegIndex = matchSegments[0]!.segmentIndex
    void matchIndex

    let prevBench = new Set<string>()
    let prevPrevBench = new Set<string>()

    for (const seg of matchSegments) {
      const isMatchStart = seg.segmentIndex === firstSegIndex
      const isMatchEnd = seg.segmentIndex === lastSegIndex
      const locked = locks.get(seg.segmentIndex)

      let chosenBench: string[]
      if (locked) {
        chosenBench = [...locked.bench]
      } else {
        chosenBench = pickBench({
          players,
          benchSpotsPerSeg,
          prevBench,
          prevPrevBench,
          stats,
          isMatchStart,
          isMatchEnd,
          isKeeperEligible,
          isL1,
          totalOnField: sportConfig.totalOnField,
          forcedFieldIds: forcedField?.get(seg.segmentIndex) ?? new Set(),
          warnings,
        })
      }

      benchBySegment[seg.segmentIndex] = chosenBench
      const benchSet = new Set(chosenBench)
      for (const playerId of chosenBench) {
        const s = stats.get(playerId)
        if (!s) continue
        s.benchCount++
        if (isMatchStart) s.startBenchCount++
        if (isMatchEnd) s.endBenchCount++
        s.lastBenchedSeg = seg.segmentIndex
      }
      // Every non-benched player gained a field/keeper segment this tick.
      for (const p of players) {
        if (benchSet.has(p.id)) continue
        const s = stats.get(p.id)
        if (s) s.pitchCount++
      }
      prevPrevBench = prevBench
      prevBench = benchSet
    }
  }

  const benchCountByPlayer = new Map<string, number>()
  for (const [id, s] of stats.entries()) {
    benchCountByPlayer.set(id, s.benchCount)
  }
  return { benchBySegment, benchCountByPlayer, warnings }
}

interface PickArgs {
  players: Player[]
  benchSpotsPerSeg: number
  prevBench: Set<string>
  prevPrevBench: Set<string>
  stats: Map<string, PlayerStats>
  isMatchStart: boolean
  isMatchEnd: boolean
  isKeeperEligible: (p: Player) => boolean
  isL1: (p: Player) => boolean
  totalOnField: number
  forcedFieldIds: Set<string>
  warnings: SchedulerWarning[]
}

function pickBench(args: PickArgs): string[] {
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
    warnings,
  } = args

  if (benchSpotsPerSeg <= 0) return []

  // Hard exclusions: A3 (last segment) + A9 (segment two back) + forced-field (e.g. designated keeper).
  const hardExcluded = new Set<string>([...prevBench, ...prevPrevBench, ...args.forcedFieldIds])

  // Candidates respecting A3/A9 + forced-field.
  let candidates = players.filter((p) => !hardExcluded.has(p.id))

  // If too few candidates, relax A9 first (two-back exclusion), then A3 — but never relax forced-field.
  if (candidates.length < benchSpotsPerSeg) {
    candidates = players.filter((p) => !prevBench.has(p.id) && !args.forcedFieldIds.has(p.id))
    warnings.push({
      kind: 'bench-rotation-impossible',
      message: 'Could not honour 2-segment field minimum after returning from bench — schedule too tight.',
    })
  }
  if (candidates.length < benchSpotsPerSeg) {
    candidates = players.filter((p) => !args.forcedFieldIds.has(p.id))
    warnings.push({
      kind: 'bench-rotation-impossible',
      message: 'Could not avoid back-to-back bench — schedule too tight.',
    })
  }

  const sorted = [...candidates].sort((a, b) => compareForBench(a, b, args))

  const picked: string[] = []
  let l1Picked = 0
  let keeperEligibleAvailable = players.filter(isKeeperEligible).length
  const onBenchKeeperEligible = (id: string) => {
    const p = players.find((pl) => pl.id === id)
    return p ? isKeeperEligible(p) : false
  }

  // Account for already-fixed prevBench keeper-eligible? No — only current segment matters.
  for (const p of sorted) {
    if (picked.length >= benchSpotsPerSeg) break
    if (isL1(p) && l1Picked >= 1) continue
    // Keeper-on-field guard: ensure at least 1 keeper-eligible remains on field.
    if (isKeeperEligible(p) && keeperEligibleAvailable - 1 < 1) continue
    picked.push(p.id)
    if (isL1(p)) l1Picked++
    if (isKeeperEligible(p)) keeperEligibleAvailable--
  }

  // If we couldn't fill due to A10 / keeper guard, relax keeper guard first then A10.
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

  void isMatchEnd
  void isMatchStart
  return picked
}

function compareForBench(a: Player, b: Player, args: PickArgs): number {
  const { stats, isMatchStart, isMatchEnd } = args
  const sa = stats.get(a.id)!
  const sb = stats.get(b.id)!

  // B1: more total pitch time so far → benched next (equalize total pitch time, keeper counts as pitch).
  if (sa.pitchCount !== sb.pitchCount) return sb.pitchCount - sa.pitchCount

  // Tie on pitch: fewer benches → bench next (still tracks fairness when pitch count equal).
  if (sa.benchCount !== sb.benchCount) return sa.benchCount - sb.benchCount

  // C1: at match start, prefer player who has started on bench least.
  if (isMatchStart && sa.startBenchCount !== sb.startBenchCount) {
    return sa.startBenchCount - sb.startBenchCount
  }
  // C2: at match end, prefer player who has ended on bench least.
  if (isMatchEnd && sa.endBenchCount !== sb.endBenchCount) {
    return sa.endBenchCount - sb.endBenchCount
  }

  // FIFO: whoever was benched longest ago benches first.
  if (sa.lastBenchedSeg !== sb.lastBenchedSeg) return sa.lastBenchedSeg - sb.lastBenchedSeg

  // Deterministic by id.
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}
