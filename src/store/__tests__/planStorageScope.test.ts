import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatchPlan, SavedItem } from '../../types'
import { makeFiveASide, makePlayers } from '../../scheduler/__tests__/fixtures'
import { setPlanStorageScope, useSavedPlansStore } from '../savedPlansStore'
import { ANON_PLANS_KEY, mergeAnonymousItems, plansStorageKey } from '../planStorageScope'

const values = vi.hoisted(() => {
  const values = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
    clear: () => values.clear(),
  } })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: globalThis.localStorage } })
  return values
})

function base(name: string): Omit<MatchPlan, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name,
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
  }
}

const names = () => useSavedPlansStore.getState().items.map((item) => item.plan.name)
const stored = (key: string) => JSON.parse(values.get(key) ?? 'null') as { state: { items: SavedItem[] } } | null

beforeEach(async () => {
  localStorage.clear()
  await setPlanStorageScope(null)
  useSavedPlansStore.setState({ items: [], currentMatchId: null })
})

describe('mergeAnonymousItems', () => {
  it('appends signed-out plans and keeps the account copy on id collisions', () => {
    const plan = (id: string, name: string) => ({ kind: 'match', plan: { id, name } }) as SavedItem
    const merged = mergeAnonymousItems([plan('a', 'account A')], [plan('a', 'anon A'), plan('b', 'anon B')])
    expect(merged.map((item) => item.plan.name)).toEqual(['account A', 'anon B'])
  })
})

describe('setPlanStorageScope', () => {
  it('claims signed-out plans for the first account that signs in', async () => {
    useSavedPlansStore.getState().createMatch(base('Saturday'))
    await setPlanStorageScope('user_1')
    expect(names()).toEqual(['Saturday'])
    expect(stored(plansStorageKey('user_1'))?.state.items).toHaveLength(1)
    expect(values.has(ANON_PLANS_KEY)).toBe(false)
  })

  it('hides account plans after sign-out and restores them on sign-in', async () => {
    await setPlanStorageScope('user_1')
    useSavedPlansStore.getState().createMatch(base('Mine'))
    await setPlanStorageScope(null)
    expect(names()).toEqual([])
    expect(useSavedPlansStore.getState().currentMatchId).toBeNull()
    await setPlanStorageScope('user_1')
    expect(names()).toEqual(['Mine'])
  })

  it('keeps accounts on one device separate', async () => {
    await setPlanStorageScope('user_1')
    useSavedPlansStore.getState().createMatch(base('One'))
    await setPlanStorageScope('user_2')
    expect(names()).toEqual([])
    useSavedPlansStore.getState().createMatch(base('Two'))
    await setPlanStorageScope('user_1')
    expect(names()).toEqual(['One'])
  })

  it('merges plans made while signed out into an existing account', async () => {
    await setPlanStorageScope('user_1')
    useSavedPlansStore.getState().createMatch(base('Old'))
    await setPlanStorageScope(null)
    useSavedPlansStore.getState().createMatch(base('Offline'))
    await setPlanStorageScope('user_1')
    expect(names()).toEqual(['Old', 'Offline'])
  })
})
