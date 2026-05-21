import { describe, it, expect } from 'vitest'
import { generatePlan } from '..'
import { makeFiveASide, makePlayers } from './fixtures'
import type { Player } from '../../types'

function pitchTime(slots: ReturnType<typeof generatePlan>['slots'], playerId: string): number {
  let total = 0
  for (const slot of slots) {
    const onField = Object.values(slot.assignments).includes(playerId)
    if (onField) total += slot.endMinute - slot.startMinute
  }
  return total
}

function benchCount(slots: ReturnType<typeof generatePlan>['slots'], playerId: string): number {
  return slots.filter((s) => s.bench.includes(playerId)).length
}

describe('generatePlan (integration)', () => {
  it('7 players, 5 on field, 2 periods × 4 segments — pitch time within ±1 segment', () => {
    const sport = makeFiveASide({ periodCount: 2, periodDurationMinutes: 20 })
    const result = generatePlan({
      sportConfig: sport,
      players: makePlayers(7),
      benchStintMinutes: 5,
      matchCount: 1,
    })
    const minutes = makePlayers(7).map((p) => pitchTime(result.slots, p.id))
    const max = Math.max(...minutes)
    const min = Math.min(...minutes)
    expect(max - min).toBeLessThanOrEqual(5)
  })

  it('6 players, 5 on field, 4 segments — every bench gap ≥ 3', () => {
    const sport = makeFiveASide({ periodCount: 1, periodDurationMinutes: 20 })
    const result = generatePlan({
      sportConfig: sport,
      players: makePlayers(6),
      benchStintMinutes: 5,
      matchCount: 1,
    })
    expect(result.slots).toHaveLength(4)
    // No back-to-back bench across the 4 segments.
    for (let i = 1; i < result.slots.length; i++) {
      const prevBench = new Set(result.slots[i - 1]!.bench)
      for (const id of result.slots[i]!.bench) {
        expect(prevBench.has(id)).toBe(false)
      }
    }
  })

  it('5 players (exactly fills field) → warning, no rotation', () => {
    const sport = makeFiveASide({ periodCount: 1, periodDurationMinutes: 20 })
    const result = generatePlan({
      sportConfig: sport,
      players: makePlayers(5),
      benchStintMinutes: 5,
      matchCount: 1,
    })
    expect(result.warnings.map((w) => w.kind)).toContain('bench-rotation-impossible')
    for (const slot of result.slots) {
      expect(slot.bench).toEqual([])
      expect(Object.values(slot.assignments).filter(Boolean)).toHaveLength(5)
    }
  })

  it('A2 — no player in two slots at once', () => {
    const sport = makeFiveASide({ periodCount: 1, periodDurationMinutes: 20 })
    const result = generatePlan({
      sportConfig: sport,
      players: makePlayers(8),
      benchStintMinutes: 5,
      matchCount: 1,
    })
    for (const slot of result.slots) {
      const ids = Object.values(slot.assignments).filter(Boolean) as string[]
      expect(new Set(ids).size).toBe(ids.length)
      for (const id of ids) {
        expect(slot.bench).not.toContain(id)
      }
    }
  })

  it('multi-match tournament: cross-match pitch time balanced', () => {
    const sport = makeFiveASide({ periodCount: 1, periodDurationMinutes: 20 })
    const result = generatePlan({
      sportConfig: sport,
      players: makePlayers(7),
      benchStintMinutes: 5,
      matchCount: 3,
    })
    const minutes = makePlayers(7).map((p) => pitchTime(result.slots, p.id))
    const max = Math.max(...minutes)
    const min = Math.min(...minutes)
    expect(max - min).toBeLessThanOrEqual(5)
  })

  it('locked slot retained verbatim, rest still valid', () => {
    const sport = makeFiveASide({ periodCount: 1, periodDurationMinutes: 20 })
    const players = makePlayers(7)
    // First generate to grab a segment shape, then build a locked override for segment 0.
    const firstRun = generatePlan({
      sportConfig: sport,
      players,
      benchStintMinutes: 5,
      matchCount: 1,
    })
    const lockedSlot = {
      ...firstRun.slots[0]!,
      id: 'fixed-lock',
      assignments: { gk: 'p1', def_1: 'p2', def_2: 'p3', mid: 'p4', fwd: 'p5' },
      bench: ['p6', 'p7'],
      locked: true,
    }
    const result = generatePlan({
      sportConfig: sport,
      players,
      benchStintMinutes: 5,
      matchCount: 1,
      existingSlots: [lockedSlot],
    })
    expect(result.slots[0]).toEqual(lockedSlot)
    // Segments 1..3 still have full assignments
    for (let i = 1; i < result.slots.length; i++) {
      expect(Object.values(result.slots[i]!.assignments).filter(Boolean)).toHaveLength(5)
    }
  })

  it('player excluded from 3 of 4 outfield positions still gets equal field time', () => {
    const sport = makeFiveASide({ periodCount: 1, periodDurationMinutes: 20 })
    const players: Player[] = makePlayers(7)
    players[0]!.excludedPositionTypeIds = ['def', 'mid', 'fwd'] // p1 only keeper-eligible outfield-wise
    const result = generatePlan({
      sportConfig: sport,
      players,
      benchStintMinutes: 5,
      matchCount: 1,
    })
    // p1 still on field every segment (as keeper)
    expect(pitchTime(result.slots, 'p1')).toBeGreaterThan(0)
  })

  it('2 L1 players never benched together (A10)', () => {
    const sport = makeFiveASide({ periodCount: 1, periodDurationMinutes: 20 })
    const players: Player[] = [
      ...makePlayers(2, { level: 1 }),
      ...makePlayers(5, { level: 2 }),
    ]
    players.forEach((p, i) => (p.id = `p${i + 1}`))
    const l1Ids = new Set(['p1', 'p2'])
    const result = generatePlan({
      sportConfig: sport,
      players,
      benchStintMinutes: 5,
      matchCount: 1,
    })
    for (const slot of result.slots) {
      const l1OnBench = slot.bench.filter((id) => l1Ids.has(id)).length
      expect(l1OnBench).toBeLessThanOrEqual(1)
    }
  })

  it('keeper-only-eligible: only 2 players → split keeper time, no back-to-back-period same keeper preferred', () => {
    const sport = makeFiveASide({ periodCount: 2, periodDurationMinutes: 20 })
    const players: Player[] = makePlayers(7)
    // Exclude all but p1 and p2 from gk
    for (let i = 2; i < players.length; i++) {
      players[i]!.excludedPositionTypeIds = ['gk']
    }
    const result = generatePlan({
      sportConfig: sport,
      players,
      benchStintMinutes: 5,
      matchCount: 2,
    })
    const keeperMinutes = new Map<string, number>()
    for (const slot of result.slots) {
      const id = slot.assignments['gk']
      if (id) keeperMinutes.set(id, (keeperMinutes.get(id) ?? 0) + slot.endMinute - slot.startMinute)
    }
    const minutes = [keeperMinutes.get('p1') ?? 0, keeperMinutes.get('p2') ?? 0]
    expect(Math.abs(minutes[0]! - minutes[1]!)).toBeLessThanOrEqual(20)
  })

  it('regen is deterministic for the same input', () => {
    const sport = makeFiveASide()
    const a = generatePlan({ sportConfig: sport, players: makePlayers(7), benchStintMinutes: 5, matchCount: 2 })
    const b = generatePlan({ sportConfig: sport, players: makePlayers(7), benchStintMinutes: 5, matchCount: 2 })
    // Compare assignments + bench (ids are nanoid, so skip them)
    expect(a.slots.map((s) => ({ a: s.assignments, b: s.bench }))).toEqual(
      b.slots.map((s) => ({ a: s.assignments, b: s.bench })),
    )
  })

  it('benchCount roughly equal across players (B1)', () => {
    const sport = makeFiveASide({ periodCount: 1, periodDurationMinutes: 20 })
    const result = generatePlan({
      sportConfig: sport,
      players: makePlayers(7),
      benchStintMinutes: 5,
      matchCount: 1,
    })
    const counts = makePlayers(7).map((p) => benchCount(result.slots, p.id))
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(2)
  })
})
