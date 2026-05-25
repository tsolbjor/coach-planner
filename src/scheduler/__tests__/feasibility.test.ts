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
      pins: {},
    })
    expect(warnings.map((w) => w.kind)).toContain('low-player-count')
  })

  it('warns when players < totalOnField', () => {
    const warnings = checkFeasibility({
      sportConfig: makeFiveASide(),
      players: makePlayers(3),
      benchStintMinutes: 5,
      matchCount: 1,
      pins: {},
    })
    expect(warnings.map((w) => w.kind)).toContain('low-player-count')
  })

  it('warns bench-rotation-impossible when players === totalOnField', () => {
    const warnings = checkFeasibility({
      sportConfig: makeFiveASide(),
      players: makePlayers(5),
      benchStintMinutes: 5,
      matchCount: 1,
      pins: {},
    })
    expect(warnings.map((w) => w.kind)).toContain('bench-rotation-impossible')
  })

  it('no warnings for healthy 8-player 5v5 setup', () => {
    const warnings = checkFeasibility({
      sportConfig: makeFiveASide(),
      players: makePlayers(8),
      benchStintMinutes: 5,
      matchCount: 1,
      pins: {},
    })
    expect(warnings).toEqual([])
  })

  it('warns keeper-unavailable when everyone excludes gk', () => {
    const warnings = checkFeasibility({
      sportConfig: makeFiveASide(),
      players: makePlayers(8, { excluded: ['gk'] }),
      benchStintMinutes: 5,
      matchCount: 1,
      pins: {},
    })
    expect(warnings.map((w) => w.kind)).toContain('keeper-unavailable')
  })

  it('warns l1-cap-infeasible when L1 count exceeds field + 1', () => {
    const players = [...makePlayers(7, { level: 1 }), ...makePlayers(1, { level: 2 })]
    players.forEach((p, i) => (p.id = `p${i + 1}`))
    const warnings = checkFeasibility({
      sportConfig: makeFiveASide(),
      players,
      benchStintMinutes: 5,
      matchCount: 1,
      pins: {},
    })
    expect(warnings.map((w) => w.kind)).toContain('l1-cap-infeasible')
  })

  it('flags lock-conflict when gk pin assigns excluded player', () => {
    const players = makePlayers(8)
    players[0]!.excludedPositionTypeIds = ['gk']
    const warnings = checkFeasibility({
      sportConfig: makeFiveASide(),
      players,
      benchStintMinutes: 5,
      matchCount: 1,
      pins: { 0: { gkId: 'p1' } },
    })
    expect(warnings.map((w) => w.kind)).toContain('lock-conflict')
  })

  it('flags lock-conflict when same player pinned to field and bench', () => {
    const warnings = checkFeasibility({
      sportConfig: makeFiveASide(),
      players: makePlayers(8),
      benchStintMinutes: 5,
      matchCount: 1,
      pins: { 0: { fieldIds: ['p1', 'p2'], benchIds: ['p1', 'p3'] } },
    })
    expect(warnings.map((w) => w.kind)).toContain('lock-conflict')
  })
})
