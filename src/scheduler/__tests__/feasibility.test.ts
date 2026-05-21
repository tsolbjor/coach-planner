import { describe, it, expect } from 'vitest'
import { checkFeasibility } from '../feasibility'
import { makeFiveASide, makePlayers } from './fixtures'

describe('checkFeasibility', () => {
  it('returns low-player-count when roster is empty', () => {
    const warnings = checkFeasibility({
      sportConfig: makeFiveASide(),
      players: [],
      benchStintMinutes: 5,
      matchCount: 1,
      existingSlots: [],
    })
    expect(warnings.map((w) => w.kind)).toContain('low-player-count')
  })

  it('warns when players < totalOnField', () => {
    const warnings = checkFeasibility({
      sportConfig: makeFiveASide(),
      players: makePlayers(3),
      benchStintMinutes: 5,
      matchCount: 1,
      existingSlots: [],
    })
    expect(warnings.map((w) => w.kind)).toContain('low-player-count')
  })

  it('warns bench-rotation-impossible when players === totalOnField', () => {
    const warnings = checkFeasibility({
      sportConfig: makeFiveASide(),
      players: makePlayers(5),
      benchStintMinutes: 5,
      matchCount: 1,
      existingSlots: [],
    })
    expect(warnings.map((w) => w.kind)).toContain('bench-rotation-impossible')
  })

  it('no warnings for healthy 8-player 5v5 setup', () => {
    const warnings = checkFeasibility({
      sportConfig: makeFiveASide(),
      players: makePlayers(8),
      benchStintMinutes: 5,
      matchCount: 1,
      existingSlots: [],
    })
    expect(warnings).toEqual([])
  })

  it('warns keeper-unavailable when everyone excludes gk', () => {
    const warnings = checkFeasibility({
      sportConfig: makeFiveASide(),
      players: makePlayers(8, { excluded: ['gk'] }),
      benchStintMinutes: 5,
      matchCount: 1,
      existingSlots: [],
    })
    expect(warnings.map((w) => w.kind)).toContain('keeper-unavailable')
  })

  it('warns l1-cap-infeasible when L1 count exceeds field + 1', () => {
    // 5v5 → field 5, threshold > 6 L1s → 7+ triggers
    const players = [...makePlayers(7, { level: 1 }), ...makePlayers(1, { level: 2 })]
    // Reassign distinct ids
    players.forEach((p, i) => (p.id = `p${i + 1}`))
    const warnings = checkFeasibility({
      sportConfig: makeFiveASide(),
      players,
      benchStintMinutes: 5,
      matchCount: 1,
      existingSlots: [],
    })
    expect(warnings.map((w) => w.kind)).toContain('l1-cap-infeasible')
  })

  it('does not warn l1-cap-infeasible when L1 count is field + 1 or less', () => {
    const players = [
      ...makePlayers(6, { level: 1 }),
      ...makePlayers(2, { level: 2 }),
    ]
    players.forEach((p, i) => (p.id = `p${i + 1}`))
    const warnings = checkFeasibility({
      sportConfig: makeFiveASide(),
      players,
      benchStintMinutes: 5,
      matchCount: 1,
      existingSlots: [],
    })
    expect(warnings.map((w) => w.kind)).not.toContain('l1-cap-infeasible')
  })

  it('flags lock conflict when locked slot assigns player to excluded position', () => {
    const players = makePlayers(8)
    players[0]!.excludedPositionTypeIds = ['gk']
    const warnings = checkFeasibility({
      sportConfig: makeFiveASide(),
      players,
      benchStintMinutes: 5,
      matchCount: 1,
      existingSlots: [
        {
          id: 'lock1',
          matchIndex: 0,
          periodIndex: 0,
          startMinute: 0,
          endMinute: 5,
          assignments: { gk: 'p1', def_1: 'p2', def_2: 'p3', mid: 'p4', fwd: 'p5' },
          bench: ['p6', 'p7', 'p8'],
          locked: true,
        },
      ],
    })
    expect(warnings.map((w) => w.kind)).toContain('lock-conflict')
  })

  it('flags lock conflict when same player is on field and bench', () => {
    const warnings = checkFeasibility({
      sportConfig: makeFiveASide(),
      players: makePlayers(8),
      benchStintMinutes: 5,
      matchCount: 1,
      existingSlots: [
        {
          id: 'lock1',
          matchIndex: 0,
          periodIndex: 0,
          startMinute: 0,
          endMinute: 5,
          assignments: { gk: 'p1', def_1: 'p2', def_2: 'p3', mid: 'p4', fwd: 'p5' },
          bench: ['p5', 'p6', 'p7'],
          locked: true,
        },
      ],
    })
    expect(warnings.map((w) => w.kind)).toContain('lock-conflict')
  })

  it('ignores non-locked existing slots', () => {
    const players = makePlayers(8)
    players[0]!.excludedPositionTypeIds = ['gk']
    const warnings = checkFeasibility({
      sportConfig: makeFiveASide(),
      players,
      benchStintMinutes: 5,
      matchCount: 1,
      existingSlots: [
        {
          id: 'unlocked',
          matchIndex: 0,
          periodIndex: 0,
          startMinute: 0,
          endMinute: 5,
          assignments: { gk: 'p1', def_1: 'p2', def_2: 'p3', mid: 'p4', fwd: 'p5' },
          bench: ['p6', 'p7', 'p8'],
          locked: false,
        },
      ],
    })
    expect(warnings.map((w) => w.kind)).not.toContain('lock-conflict')
  })
})
