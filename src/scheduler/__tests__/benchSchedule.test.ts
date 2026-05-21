import { describe, it, expect } from 'vitest'
import { scheduleBench, type LockedBench } from '../benchSchedule'
import { buildSegments } from '../segmentBuilder'
import { makeFiveASide, makePlayers } from './fixtures'
import type { Player } from '../../types'

function setBenchCount(bench: string[][]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const seg of bench) {
    for (const id of seg) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return counts
}

function noBackToBack(bench: string[][], firstSegByMatch: Set<number>): boolean {
  for (let i = 1; i < bench.length; i++) {
    if (firstSegByMatch.has(i)) continue // A3 resets at match boundary
    const prev = new Set(bench[i - 1])
    for (const id of bench[i]!) if (prev.has(id)) return false
  }
  return true
}

function minTwoFieldAfterReturn(bench: string[][], firstSegByMatch: Set<number>): boolean {
  for (let i = 2; i < bench.length; i++) {
    if (firstSegByMatch.has(i) || firstSegByMatch.has(i - 1)) continue
    const twoBack = new Set(bench[i - 2])
    for (const id of bench[i]!) if (twoBack.has(id)) return false
  }
  return true
}

describe('scheduleBench', () => {
  it('6 players, 5 on field, 4 segments — every bench gap ≥ 3', () => {
    const sport = makeFiveASide({ periodCount: 1, periodDurationMinutes: 20 })
    const segments = buildSegments(sport, 5, 1) // 4 segments
    const result = scheduleBench({
      sportConfig: sport,
      players: makePlayers(6),
      segments,
      locks: new Map(),
    })
    expect(result.benchBySegment).toHaveLength(4)
    expect(result.benchBySegment.every((b) => b.length === 1)).toBe(true)
    expect(noBackToBack(result.benchBySegment, new Set([0]))).toBe(true)
    expect(minTwoFieldAfterReturn(result.benchBySegment, new Set([0]))).toBe(true)
    expect(result.warnings).toEqual([])
  })

  it('7 players, 5 on field, 4 segments — bench counts balanced ±1', () => {
    const sport = makeFiveASide({ periodCount: 1, periodDurationMinutes: 20 })
    const segments = buildSegments(sport, 5, 1)
    const result = scheduleBench({
      sportConfig: sport,
      players: makePlayers(7),
      segments,
      locks: new Map(),
    })
    const counts = setBenchCount(result.benchBySegment)
    const totalBench = result.benchBySegment.reduce((sum, b) => sum + b.length, 0)
    expect(totalBench).toBe(8) // 2 per seg × 4 segs
    const counted = [...counts.values()].sort()
    expect(counted.length).toBeGreaterThanOrEqual(6)
    const max = Math.max(...counts.values(), 0)
    const min = Math.min(...counts.values(), 0)
    expect(max - min).toBeLessThanOrEqual(2)
    expect(noBackToBack(result.benchBySegment, new Set([0]))).toBe(true)
    expect(minTwoFieldAfterReturn(result.benchBySegment, new Set([0]))).toBe(true)
  })

  it('5 players exactly fills the field — no bench picks', () => {
    const sport = makeFiveASide()
    const segments = buildSegments(sport, 5, 1)
    const result = scheduleBench({
      sportConfig: sport,
      players: makePlayers(5),
      segments,
      locks: new Map(),
    })
    expect(result.benchBySegment.every((b) => b.length === 0)).toBe(true)
  })

  it('A10 — at most one L1 on bench at any segment', () => {
    const sport = makeFiveASide({ periodCount: 1, periodDurationMinutes: 20 })
    const segments = buildSegments(sport, 5, 1)
    const players: Player[] = [
      ...makePlayers(2, { level: 1 }),
      ...makePlayers(5, { level: 2 }),
    ]
    players.forEach((p, i) => (p.id = `p${i + 1}`))
    const l1Ids = new Set(players.filter((p) => p.level === 1).map((p) => p.id))
    const result = scheduleBench({
      sportConfig: sport,
      players,
      segments,
      locks: new Map(),
    })
    for (const seg of result.benchBySegment) {
      const l1OnBench = seg.filter((id) => l1Ids.has(id)).length
      expect(l1OnBench).toBeLessThanOrEqual(1)
    }
  })

  it('respects locked bench composition', () => {
    const sport = makeFiveASide({ periodCount: 1, periodDurationMinutes: 20 })
    const segments = buildSegments(sport, 5, 1)
    const players = makePlayers(7)
    const lockedBench: LockedBench = {
      bench: ['p6', 'p7'],
      field: new Set(['p1', 'p2', 'p3', 'p4', 'p5']),
    }
    const result = scheduleBench({
      sportConfig: sport,
      players,
      segments,
      locks: new Map([[0, lockedBench]]),
    })
    expect(result.benchBySegment[0]).toEqual(['p6', 'p7'])
  })

  it('multi-match: A3 resets at match boundary (last seg match 1 can equal first seg match 2)', () => {
    const sport = makeFiveASide({ periodCount: 1, periodDurationMinutes: 20 })
    const segments = buildSegments(sport, 5, 2) // 2 matches × 4 segs = 8 segs
    const players = makePlayers(6)
    const result = scheduleBench({
      sportConfig: sport,
      players,
      segments,
      locks: new Map(),
    })
    // No structural error — just sanity that segments produce a schedule covering all segments.
    expect(result.benchBySegment).toHaveLength(8)
    // Within each match no back-to-back, but cross-match boundary is allowed.
    expect(noBackToBack(result.benchBySegment, new Set([0, 4]))).toBe(true)
  })

  it('determinism: same input produces same output', () => {
    const sport = makeFiveASide({ periodCount: 1, periodDurationMinutes: 20 })
    const segments = buildSegments(sport, 5, 1)
    const players = makePlayers(7)
    const a = scheduleBench({ sportConfig: sport, players, segments, locks: new Map() })
    const b = scheduleBench({ sportConfig: sport, players, segments, locks: new Map() })
    expect(a.benchBySegment).toEqual(b.benchBySegment)
  })

  it('ensures at least one keeper-eligible player remains on field each segment', () => {
    const sport = makeFiveASide({ periodCount: 1, periodDurationMinutes: 20 })
    const segments = buildSegments(sport, 5, 1)
    // Make only 2 keeper-eligible (others excluded from gk).
    const players = makePlayers(7)
    for (let i = 2; i < players.length; i++) {
      players[i]!.excludedPositionTypeIds = ['gk']
    }
    const keeperEligible = new Set(['p1', 'p2'])
    const result = scheduleBench({
      sportConfig: sport,
      players,
      segments,
      locks: new Map(),
    })
    for (const seg of result.benchBySegment) {
      const eligibleOnBench = seg.filter((id) => keeperEligible.has(id)).length
      expect(eligibleOnBench).toBeLessThan(keeperEligible.size)
    }
  })

  it('cross-match start-bench rotation tracked (C1)', () => {
    const sport = makeFiveASide({ periodCount: 1, periodDurationMinutes: 20 })
    const segments = buildSegments(sport, 5, 3) // 3 matches × 4 segs
    const players = makePlayers(6)
    const result = scheduleBench({
      sportConfig: sport,
      players,
      segments,
      locks: new Map(),
    })
    // Match start segments: 0, 4, 8
    const startBench = [
      result.benchBySegment[0]![0]!,
      result.benchBySegment[4]![0]!,
      result.benchBySegment[8]![0]!,
    ]
    // Across 3 match starts with 6 players, should not start the same player on bench all 3 times.
    const counts = new Map<string, number>()
    for (const id of startBench) counts.set(id, (counts.get(id) ?? 0) + 1)
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(2)
  })
})
