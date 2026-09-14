import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatchPlan } from '../../types'
import * as scheduler from '../../scheduler'
import { makeFiveASide, makePlayers } from '../../scheduler/__tests__/fixtures'
import { useSavedPlansStore } from '../savedPlansStore'
import { buildSportConfigFromRows, rowsFromSportConfig } from '../../components/plan-modals/positionRows'

vi.hoisted(() => {
  const values = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
    clear: () => values.clear(),
  } })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: globalThis.localStorage } })
})

function base(overrides: Partial<MatchPlan> = {}): Omit<MatchPlan, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: 'Test match',
    sportConfig: makeFiveASide({ periodCount: 2, periodDurationMinutes: 20 }),
    roster: makePlayers(7),
    benchStintMinutes: 5,
    matchCount: 1,
    absentPlayerIds: [],
    pins: {},
    slots: [],
    changeKeeperMidPeriod: false,
    maxBenchSegments: 1,
    minSubsPerSegment: 0,
    maxSubsPerSegment: 2,
    ...overrides,
  }
}

function current(id: string): MatchPlan {
  const item = useSavedPlansStore.getState().getSaved(id)!
  if (item.kind !== 'match') throw new Error('Expected match')
  return item.plan
}

beforeEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  useSavedPlansStore.setState({ items: [], currentMatchId: null })
})

describe('saved plan generation ownership', () => {
  it('generates once on create, stores diagnostics, and does not regenerate cosmetic changes', () => {
    const generate = vi.spyOn(scheduler, 'generatePlan')
    const plan = useSavedPlansStore.getState().createMatch(base({ roster: makePlayers(5) }))
    expect(generate).toHaveBeenCalledTimes(1)
    expect(plan.slots).toHaveLength(8)
    expect(plan.warnings?.some((w) => w.kind === 'bench-rotation-impossible')).toBe(true)
    useSavedPlansStore.getState().updateMatch(plan.id, { name: 'Renamed' })
    useSavedPlansStore.getState().updateMatchPlayer(plan.id, plan.roster[0]!.id, { name: 'Alex' })
    expect(generate).toHaveBeenCalledTimes(1)
    expect(current(plan.id).slots).toBe(plan.slots)
    expect(current(plan.id).warnings).toEqual(plan.warnings)
  })

  it('generates once per roster, settings, absence, and pin action', () => {
    const plan = useSavedPlansStore.getState().createMatch(base())
    const generate = vi.spyOn(scheduler, 'generatePlan')
    const store = useSavedPlansStore.getState()
    store.updateMatch(plan.id, { maxSubsPerSegment: 1 })
    expect(generate).toHaveBeenCalledTimes(1)
    store.updateMatchPlayer(plan.id, plan.roster[0]!.id, { level: 3 })
    expect(generate).toHaveBeenCalledTimes(2)
    store.addMatchPlayer(plan.id, { name: 'New player', level: 2, excludedPositionTypeIds: [] })
    expect(generate).toHaveBeenCalledTimes(3)
    store.removeMatchPlayer(plan.id, current(plan.id).roster.at(-1)!.id)
    expect(generate).toHaveBeenCalledTimes(4)
    store.updateMatch(plan.id, { absentPlayerIds: [plan.roster[6]!.id] })
    expect(generate).toHaveBeenCalledTimes(5)
    store.setSegmentPin(plan.id, 1, { requiredBenchIds: [plan.roster[2]!.id] })
    expect(generate).toHaveBeenCalledTimes(6)
    expect(current(plan.id).slots[1]!.benchIds).toContain(plan.roster[2]!.id)
    store.clearSegmentPin(plan.id, 1)
    expect(generate).toHaveBeenCalledTimes(7)
  })

  it('generates on save/import and hydration without losing diagnostics', async () => {
    const plan = useSavedPlansStore.getState().createMatch(base({ roster: makePlayers(5) }))
    const generate = vi.spyOn(scheduler, 'generatePlan')
    useSavedPlansStore.getState().saveMatch({ ...plan, slots: [], warnings: [] })
    expect(generate).toHaveBeenCalledTimes(1)
    const saved = current(plan.id)
    expect(saved.slots).toHaveLength(8)
    expect(saved.warnings?.length).toBeGreaterThan(0)
    await useSavedPlansStore.persist.rehydrate()
    expect(generate).toHaveBeenCalledTimes(2)
    expect(current(plan.id).warnings).toEqual(saved.warnings)
  })

  it('stores current no-player diagnostics rather than leaving stale slots', () => {
    const plan = useSavedPlansStore.getState().createMatch(base())
    useSavedPlansStore.getState().updateMatch(plan.id, { absentPlayerIds: plan.roster.map((p) => p.id) })
    expect(current(plan.id).slots).toEqual([])
    expect(current(plan.id).warnings?.some((w) => w.kind === 'low-player-count')).toBe(true)
  })
})

describe('completed play and structural setup', () => {
  it('locks earlier intervals on live edit and replays them on every later generation and hydrate', async () => {
    const plan = useSavedPlansStore.getState().createMatch(base())
    const prefix = plan.slots.slice(0, 2)
    const store = useSavedPlansStore.getState()
    store.setSegmentPins(plan.id, { 2: { requiredBenchIds: [plan.slots[2]!.fieldIds[0]!] } }, 2)
    expect(current(plan.id).lockedSlots).toEqual(prefix)
    expect(current(plan.id).slots.slice(0, 2)).toEqual(prefix)
    store.updateMatch(plan.id, { maxBenchSegments: 3 })
    expect(current(plan.id).slots.slice(0, 2)).toEqual(prefix)
    store.setSegmentPin(plan.id, 0, { gkId: 'not-a-player' })
    expect(current(plan.id).pins[0]).toBeUndefined()
    expect(current(plan.id).slots.slice(0, 2)).toEqual(prefix)
    store.clearAllPins(plan.id)
    expect(current(plan.id).slots.slice(0, 2)).toEqual(prefix)
    await useSavedPlansStore.persist.rehydrate()
    expect(current(plan.id).lockedSlots).toEqual(prefix)
    expect(current(plan.id).slots.slice(0, 2)).toEqual(prefix)
    store.updateMatch(plan.id, { benchStintMinutes: 10, pins: {}, lockedSlots: [] })
    expect(current(plan.id).benchStintMinutes).toBe(5)
    expect(current(plan.id).lockedSlots).toEqual(prefix)
  })

  it('requires an explicit pin reset for timing changes', () => {
    const plan = useSavedPlansStore.getState().createMatch(base())
    const store = useSavedPlansStore.getState()
    store.setSegmentPin(plan.id, 1, { gkId: plan.slots[1]!.gkId })
    for (const updates of [
      { benchStintMinutes: 10 }, { matchCount: 2 }, { changeKeeperMidPeriod: true },
      { sportConfig: { ...plan.sportConfig, periodCount: 3 } },
      { sportConfig: { ...plan.sportConfig, periodDurationMinutes: 25 } },
    ]) {
      store.updateMatch(plan.id, updates)
      expect(current(plan.id).benchStintMinutes).toBe(5)
      expect(current(plan.id).matchCount).toBe(1)
      expect(current(plan.id).changeKeeperMidPeriod).toBe(false)
      expect(current(plan.id).sportConfig).toEqual(plan.sportConfig)
      expect(current(plan.id).pins[1]).toBeDefined()
    }
    store.updateMatch(plan.id, { benchStintMinutes: 10, pins: {} })
    expect(current(plan.id).benchStintMinutes).toBe(10)
    expect(current(plan.id).pins).toEqual({})
    expect(current(plan.id).slots).toHaveLength(4)
  })

  it('preserves slot ids, role eligibility, and pins when labels change', () => {
    const plan = useSavedPlansStore.getState().createMatch(base())
    const store = useSavedPlansStore.getState()
    store.setSegmentPin(plan.id, 1, { gkId: plan.slots[1]!.gkId })
    const pinned = current(plan.id)
    const rows = rowsFromSportConfig(plan.sportConfig)
    rows[1]!.label = 'Custom role'
    const config = buildSportConfigFromRows(rows, plan.roster.length, 2, 20)
    expect(config.lineupSlots.map((s) => [s.slotId, s.positionTypeId]))
      .toEqual(plan.sportConfig.lineupSlots.map((s) => [s.slotId, s.positionTypeId]))
    store.updateMatch(plan.id, { sportConfig: {
      ...plan.sportConfig,
      lineupSlots: config.lineupSlots,
    } })
    expect(current(plan.id).pins).toEqual(pinned.pins)
    expect(current(plan.id).roster).toEqual(pinned.roster)
    expect(current(plan.id).slots).toBe(pinned.slots)
  })
})

describe('legacy pin migration', () => {
  it('remaps later pins by timing and duplicates overrides onto split keeper intervals', () => {
    const legacy = useSavedPlansStore.getState().createMatch(base({
      sportConfig: makeFiveASide({ periodCount: 1, periodDurationMinutes: 15 }),
    }))
    useSavedPlansStore.getState().saveMatch({
      ...legacy,
      changeKeeperMidPeriod: true,
      pins: { 1: { absentIds: ['p7'] }, 2: { gkId: 'p1' } },
    })
    const saved = current(legacy.id)
    expect(saved.slots.map((s) => [s.startMinute, s.endMinute])).toEqual([[0, 5], [5, 7.5], [7.5, 10], [10, 15]])
    expect(saved.pins).toEqual({ 1: { absentIds: ['p7'] }, 2: { absentIds: ['p7'] }, 3: { gkId: 'p1' } })
    expect(saved.slots.every((s) => !s.midSwap)).toBe(true)
  })

  it('clears ambiguous untimed saved overrides with a persistent diagnostic', () => {
    const plan = useSavedPlansStore.getState().createMatch(base())
    useSavedPlansStore.getState().saveMatch({ ...plan, slots: [], pins: { 3: { gkId: 'p1' } } })
    expect(current(plan.id).pins).toEqual({})
    expect(current(plan.id).warnings?.some((w) => w.kind === 'pin-migration')).toBe(true)
    useSavedPlansStore.getState().updateMatch(plan.id, { maxBenchSegments: 3 })
    expect(current(plan.id).warnings?.some((w) => w.kind === 'pin-migration')).toBe(true)
  })
})
