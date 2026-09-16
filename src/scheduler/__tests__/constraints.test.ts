import { describe, expect, it } from 'vitest'
import { generatePlan } from '..'
import { buildSegments } from '../segmentBuilder'
import { makeFiveASide, makePlayers } from './fixtures'
import type { SchedulerInput, SchedulerOutput } from '../types'
import type { TimeSlot } from '../../types'

const standard = (): SchedulerInput => ({
  sportConfig: makeFiveASide({ periodCount: 1 }),
  players: makePlayers(8),
  benchStintMinutes: 5,
})

function expectValid(result: SchedulerOutput, input: SchedulerInput) {
  for (const slot of result.slots) {
    const on = [...slot.fieldIds, ...(slot.gkId ? [slot.gkId] : [])]
    expect(new Set([...on, ...slot.benchIds, ...slot.absentIds]).size).toBe(input.players.length)
    expect(on).toHaveLength(input.sportConfig.totalOnField)
    expect(new Set(on).size).toBe(on.length)
    for (const position of input.sportConfig.lineupSlots) {
      const id = slot.positions[position.slotId]
      expect(id).toBeTruthy()
      expect(on).toContain(id)
      const player = input.players.find(p => p.id === id)!
      expect(player.excludedPositionTypeIds).not.toContain(position.positionTypeId)
    }
    expect(new Set(Object.values(slot.positions)).size).toBe(on.length)
  }
}

describe('combined scheduling constraints', () => {
  it('keeps rare eligible bench cover on the field and chooses a compatible keeper', () => {
    const input = standard()
    input.players.forEach(p => { if (p.id !== 'p8') p.excludedPositionTypeIds = ['fwd'] })
    const result = generatePlan(input)
    expectValid(result, input)
    for (const slot of result.slots) {
      expect(slot.positions.fwd).toBe('p8')
      expect(slot.gkId).not.toBe('p8')
    }
    expect(result.warnings.some(w => w.kind === 'position-unavailable')).toBe(false)
  })

  it('does not assign the only forward to keeper even when keeper fairness prefers them', () => {
    const input = standard()
    input.players = makePlayers(5)
    input.players.slice(1).forEach(p => { p.excludedPositionTypeIds = ['fwd'] })
    const result = generatePlan(input)
    expectValid(result, input)
    expect(result.slots.every(s => s.positions.fwd === 'p1' && s.gkId !== 'p1')).toBe(true)
  })

  it.each(['missing', 'p2', 'p3'])('rejects missing, excluded or absent keeper pin %s', (id) => {
    const input = standard()
    input.players[1]!.excludedPositionTypeIds = ['gk']
    input.pins = { 0: { gkId: id, absentIds: ['p3'] } }
    const result = generatePlan(input)
    expectValid(result, input)
    expect(result.slots[0]!.gkId).not.toBe(id)
    expect(result.warnings.some(w => w.kind === 'lock-conflict' && w.message.includes('segment 1'))).toBe(true)
  })

  it('preserves both exact compositions together with compatible targeted pins', () => {
    const input = standard()
    input.pins = {
      0: { gkId: 'p1', fieldIds: ['p2', 'p3', 'p4', 'p5'], benchIds: ['p8', 'p7', 'p6'],
        requiredFieldIds: ['p3'], requiredBenchIds: ['p7'] },
      1: { requiredFieldIds: ['p6'], requiredBenchIds: ['p2'] },
    }
    const result = generatePlan(input)
    expectValid(result, input)
    expect(result.slots[0]!.fieldIds).toEqual(input.pins[0]!.fieldIds)
    expect(result.slots[0]!.benchIds).toEqual(input.pins[0]!.benchIds)
    expect(result.slots[1]!.fieldIds).toContain('p6')
    expect(result.slots[1]!.benchIds).toContain('p2')
    expect(result.warnings.some(w => w.kind === 'lock-conflict')).toBe(false)
  })

  it('rejects conflicting targeted pins without discarding compatible exact compositions', () => {
    const input = standard()
    input.pins = { 0: { gkId: 'p1', fieldIds: ['p2', 'p3', 'p4', 'p5'], benchIds: ['p6', 'p7', 'p8'],
      requiredFieldIds: ['p6'], requiredBenchIds: ['p2'] } }
    const result = generatePlan(input)
    expectValid(result, input)
    expect(result.slots[0]!.fieldIds).toEqual(input.pins[0]!.fieldIds)
    expect(result.slots[0]!.benchIds).toEqual(input.pins[0]!.benchIds)
    expect(result.warnings.filter(w => w.kind === 'lock-conflict')).toHaveLength(2)
  })

  it('rejects an eligible keeper pin that would leave a preventable position hole', () => {
    const input = standard()
    input.players.forEach(p => { if (p.id !== 'p1') p.excludedPositionTypeIds = ['fwd'] })
    input.pins = { 0: { gkId: 'p1' } }
    const result = generatePlan(input)
    expectValid(result, input)
    expect(result.slots[0]!.positions.fwd).toBe('p1')
    expect(result.warnings.some(w => w.kind === 'lock-conflict')).toBe(true)
  })

  it('accounts for absence and reports a pin-forced continuous bench cap relaxation', () => {
    const input = standard()
    input.pins = { 0: { benchIds: ['p6', 'p7', 'p8'] },
      1: { absentIds: ['p6'], requiredBenchIds: ['p7'] } }
    const result = generatePlan(input)
    expectValid(result, input)
    expect(result.slots[1]!.benchIds).toHaveLength(2)
    expect(result.slots[1]!.benchIds).toContain('p7')
    expect(result.warnings.some(w => w.kind === 'bench-rotation-impossible' &&
      w.message.includes('segment 2') && w.message.includes('p7') && w.message.includes('10 min'))).toBe(true)
  })

  it('honours rest before a conflicting max-substitution limit and diagnoses every boundary', () => {
    const input = { ...standard(), maxSubsPerSegment: 1 }
    const result = generatePlan(input)
    expectValid(result, input)
    for (let i = 1; i < result.slots.length; i++) {
      expect(result.slots[i]!.benchIds.every(id => !result.slots[i - 1]!.benchIds.includes(id))).toBe(true)
      expect(result.warnings.some(w => w.kind === 'substitution-limit' && w.message.includes(`segment ${i + 1}`))).toBe(true)
    }
  })

  it('honours a zero churn limit until the minute-based rest cap requires rotation', () => {
    const input = { ...standard(), maxBenchSegments: 3, maxSubsPerSegment: 0 }
    const result = generatePlan(input)
    expect(result.slots[1]!.benchIds).toEqual(result.slots[0]!.benchIds)
    expect(result.slots[2]!.benchIds).toEqual(result.slots[0]!.benchIds)
    expect(result.slots[3]!.benchIds).not.toEqual(result.slots[0]!.benchIds)
    expect(result.warnings.filter(w => w.kind === 'substitution-limit')).toHaveLength(1)
  })

  it('reports L1 relaxation on each interval rather than only while selecting bench', () => {
    const input = standard()
    input.players.forEach(p => { p.level = 1 })
    const result = generatePlan(input)
    for (let i = 0; i < result.slots.length; i++) {
      expect(result.warnings.some(w => w.kind === 'l1-cap-infeasible' && w.message.includes(`segment ${i + 1}`))).toBe(true)
    }
  })

  it('never creates a phantom occupant when an empty keeper pin meets a shortage', () => {
    const input = { ...standard(), players: makePlayers(4), pins: { 0: { gkId: null } } }
    const result = generatePlan(input)
    const slot = result.slots[0]!
    expect(slot.gkId).toBeNull()
    expect(slot.fieldIds).toHaveLength(4)
    expect(slot.benchIds).toEqual([])
    expect(Object.values(slot.positions).filter(Boolean)).toHaveLength(4)
    expect(result.warnings.some(w => w.kind === 'keeper-unavailable' && w.message.includes('segment 1'))).toBe(true)
    const full = generatePlan({ ...input, players: makePlayers(8) })
    expect(full.slots[0]!.fieldIds.length + Number(!!full.slots[0]!.gkId)).toBe(5)
    expect(full.warnings.some(w => w.kind === 'lock-conflict')).toBe(true)
  })
})

describe('canonical midpoint intervals', () => {
  it.each([5, 25])('uses an exact midpoint, even with a %i minute requested stint', (stint) => {
    const input = { ...standard(), sportConfig: makeFiveASide({ periodCount: 1, periodDurationMinutes: 15 }),
      benchStintMinutes: stint, changeKeeperMidPeriod: true }
    const result = generatePlan(input)
    expectValid(result, input)
    expect(result.slots.some(s => s.startMinute === 7.5)).toBe(true)
    expect(result.slots.every(s => s.midSwap === undefined)).toBe(true)
    expect(result.slots.reduce((n, s) => n + s.endMinute - s.startMinute, 0)).toBe(15)
    expect(generatePlan(input)).toEqual(result)
  })

  it('only exchanges keeper at an extra midpoint with multiple bench players', () => {
    const input = { ...standard(), sportConfig: makeFiveASide({ periodCount: 1, periodDurationMinutes: 15 }),
      changeKeeperMidPeriod: true }
    const result = generatePlan(input)
    const before = result.slots[1]!
    const after = result.slots[2]!
    expectValid(result, input)
    expect(after.startMinute).toBe(7.5)
    expect(new Set(after.fieldIds)).toEqual(new Set(before.fieldIds))
    expect(new Set(after.benchIds)).toEqual(new Set(before.benchIds.filter(id => id !== after.gkId).concat(before.gkId!)))
    expect(result.warnings.some(w => w.message.includes('continuous bench time'))).toBe(false)
    expect(result.slots[3]!.benchIds.every(id => !after.benchIds.includes(id))).toBe(true)
  })

  it('runs normal capped bench selection when midpoint coincides with cadence', () => {
    const input = { ...standard(), changeKeeperMidPeriod: true }
    const result = generatePlan(input)
    expectValid(result, input)
    const before = result.slots[1]!
    const after = result.slots[2]!
    expect(after.startMinute).toBe(10)
    expect(after.benchIds.every(id => !before.benchIds.includes(id))).toBe(true)
    expect(before.benchIds).toContain(after.gkId)
    expect(result.warnings.some(w => w.message.includes('continuous bench time'))).toBe(false)
  })

  it('does not round actual intervals or count a midpoint twice for rest', () => {
    const segments = buildSegments(makeFiveASide({ periodCount: 1 }), 6, 1, true)
    expect(segments).toHaveLength(4)
    expect(segments[0]!.endMinute).toBe(20 / 3)
    expect(segments[1]!.endMinute).toBe(10)
    expect(segments[2]!.regularSubstitution).toBe(false)
    expect(segments.every(s => s.substitutionMinutes === 20 / 3)).toBe(true)
  })

  it('still splits a single original interval when no alternative keeper is eligible', () => {
    const input = { ...standard(), benchStintMinutes: 20, changeKeeperMidPeriod: true }
    input.players.slice(1).forEach(p => { p.excludedPositionTypeIds = ['gk'] })
    const result = generatePlan(input)
    expectValid(result, input)
    expect(result.slots.map(s => [s.startMinute, s.endMinute])).toEqual([[0, 10], [10, 20]])
    expect(result.slots.map(s => s.gkId)).toEqual(['p1', 'p1'])
    expect(result.warnings.some(w => w.message.includes('Keeper mid-period swap skipped') &&
      w.message.includes('segment 2'))).toBe(true)
  })
})

describe('immutable historical intervals', () => {
  it('replays completed play exactly, ignores contradictory old pins, and continues fairness', () => {
    const input = { ...standard(), sportConfig: makeFiveASide(), changeKeeperMidPeriod: true }
    const original = generatePlan(input)
    const lockedSlots = structuredClone(original.slots.slice(0, 3))
    const snapshot = structuredClone(lockedSlots)
    const replayed = generatePlan({ ...input, lockedSlots })
    expect(replayed.slots).toEqual(original.slots)
    const edited = generatePlan({ ...input, lockedSlots, pins: {
      0: { requiredBenchIds: [lockedSlots[0]!.gkId!] },
      3: { requiredFieldIds: [original.slots[3]!.benchIds[0]!] },
    } })
    expect(edited.slots.slice(0, 3)).toEqual(snapshot)
    expect(lockedSlots).toEqual(snapshot)
    expect(edited.slots[3]!.fieldIds).toContain(original.slots[3]!.benchIds[0])
    expect(edited.warnings.some(w => w.kind === 'lock-conflict' && w.message.includes('completed play'))).toBe(true)
  })

  it('uses elapsed keeper minutes rather than the number of historical split intervals', () => {
    const input = { ...standard(), players: makePlayers(5), sportConfig: makeFiveASide(),
      benchStintMinutes: 6, changeKeeperMidPeriod: true }
    input.players.slice(2).forEach(p => { p.excludedPositionTypeIds = ['gk'] })
    const original = generatePlan(input)
    const keeperIds = ['p1', 'p2', 'p2', 'p1']
    const lockedSlots: TimeSlot[] = original.slots.slice(0, 4).map((slot, index) => {
      const gkId = keeperIds[index]!
      const fieldIds = input.players.map(p => p.id).filter(id => id !== gkId)
      return { ...slot, gkId, fieldIds, positions: Object.fromEntries(input.sportConfig.lineupSlots.map((s, i) =>
        [s.slotId, i === 0 ? gkId : fieldIds[i - 1]!])) }
    })
    const result = generatePlan({ ...input, lockedSlots })
    expect(result.slots.slice(0, 4)).toEqual(lockedSlots)
    expect(result.slots[4]!.gkId).toBe('p2')
  })

  it('refuses incompatible timing without rewriting historical data', () => {
    const input = standard()
    const lockedSlots = generatePlan(input).slots.slice(0, 2)
    const result = generatePlan({ ...input, benchStintMinutes: 4, lockedSlots })
    expect(result.slots).toEqual(lockedSlots)
    expect(result.warnings[0]!.kind).toBe('invalid-input')
  })

  it('preserves historical participants now excluded from the active generator roster', () => {
    const input = { ...standard(), changeKeeperMidPeriod: true }
    const original = generatePlan(input)
    const lockedSlots = original.slots.slice(0, 3)
    const departedId = lockedSlots[2]!.gkId
    const result = generatePlan({ ...input, lockedSlots, players: input.players.filter(p => p.id !== departedId) })
    expect(result.slots).toHaveLength(original.slots.length)
    expect(result.slots.slice(0, 3)).toEqual(lockedSlots)
    expect(result.slots.slice(3).every(s => s.gkId !== departedId &&
      !s.fieldIds.includes(departedId!) && !s.benchIds.includes(departedId!))).toBe(true)
    expect(result.warnings.some(w => w.kind === 'invalid-input')).toBe(false)
  })

  it('carries exact historical positions forward rather than regenerating their overlay', () => {
    const input = { ...standard(), players: makePlayers(5) }
    const locked = structuredClone(generatePlan(input).slots[0]!)
    const left = locked.positions.def_1
    locked.positions.def_1 = locked.positions.def_2 ?? null
    locked.positions.def_2 = left ?? null
    const result = generatePlan({ ...input, lockedSlots: [locked] })
    expect(result.slots[0]).toEqual(locked)
    expect(result.slots[1]!.positions).toEqual(locked.positions)
  })
})

describe('invalid timing inputs', () => {
  it.each([0, -1, NaN, Infinity, 1e-100])('rejects unsafe substitution interval %s', (benchStintMinutes) => {
    const result = generatePlan({ ...standard(), benchStintMinutes })
    expect(result.slots).toEqual([])
    expect(result.warnings[0]!.kind).toBe('invalid-input')
  })
  it.each([0, -1, 1.5, Infinity])('rejects invalid match count %s', (matchCount) => {
    expect(generatePlan({ ...standard(), matchCount }).warnings[0]!.kind).toBe('invalid-input')
  })
})
