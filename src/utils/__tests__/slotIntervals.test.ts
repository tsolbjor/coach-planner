import { describe, expect, it } from 'vitest'
import type { TimeSlot } from '../../types'
import { expandSlotEntries, formatMinute, getSlotIntervals, groupSlotsByPeriod } from '../slotIntervals'
import { getSlotPitchMinutesByPlayer } from '../pitchTime'
import { getBoundaryTransition, getSlotEndOnFieldIds, getSlotStartOnFieldIds } from '../slotTransitions'

const legacy: TimeSlot = {
  id: 'legacy',
  matchIndex: 0,
  periodIndex: 0,
  startMinute: 5,
  endMinute: 10,
  gkId: 'incoming',
  fieldIds: ['field'],
  benchIds: ['outgoing'],
  absentIds: ['absent'],
  absentCreditedIds: ['absent'],
  positions: { gk: 'incoming', field: 'field' },
  midSwap: {
    atMinute: 7.5,
    preGkId: 'outgoing',
    preFieldIds: ['field'],
    preBenchIds: ['incoming'],
    prePositions: { gk: 'outgoing', field: 'field' },
  },
}

describe('chronological intervals', () => {
  it('reads legacy midpoint state as two ordinary intervals without mutating the source', () => {
    const before = structuredClone(legacy)
    const intervals = getSlotIntervals(legacy)
    expect(intervals.map((slot) => [slot.startMinute, slot.endMinute, slot.gkId])).toEqual([
      [5, 7.5, 'outgoing'], [7.5, 10, 'incoming'],
    ])
    expect(intervals.every((slot) => !slot.midSwap)).toBe(true)
    expect(intervals[0]!.positions.gk).toBe('outgoing')
    expect(legacy).toEqual(before)
    expect(expandSlotEntries([legacy]).map((entry) => entry.index)).toEqual([0, 0])
    expect(getBoundaryTransition(intervals[0]!, intervals[1])).toEqual({
      off: ['outgoing'], on: ['incoming'],
    })
  })

  it('preserves minute totals including credited absence after flattening', () => {
    const totals = new Map<string, number>()
    for (const slot of getSlotIntervals(legacy)) {
      for (const [id, minutes] of getSlotPitchMinutesByPlayer(slot)) {
        totals.set(id, (totals.get(id) ?? 0) + minutes)
      }
    }
    expect(totals).toEqual(getSlotPitchMinutesByPlayer(legacy))
    expect(Object.fromEntries(totals)).toEqual({ absent: 5, outgoing: 2.5, field: 5, incoming: 2.5 })
  })

  it.each([5, 10])('does not introduce zero-length phases at %i minutes', (atMinute) => {
    const slots = getSlotIntervals({ ...legacy, midSwap: { ...legacy.midSwap!, atMinute } })
    expect(slots).toHaveLength(1)
    expect(slots[0]!.endMinute - slots[0]!.startMinute).toBe(5)
    const edgeSlot = { ...legacy, midSwap: { ...legacy.midSwap!, atMinute } }
    expect(getSlotStartOnFieldIds(edgeSlot)).toEqual(getSlotStartOnFieldIds(slots[0]!))
    expect(getSlotEndOnFieldIds(edgeSlot)).toEqual(getSlotEndOnFieldIds(slots[0]!))
  })

  it('groups repeated period numbers separately for each match', () => {
    const groups = groupSlotsByPeriod([legacy, { ...legacy, matchIndex: 1, id: 'match2' }])
    expect(groups.map((group) => [group.matchIndex, group.periodIndex, group.slots.length])).toEqual([
      [0, 0, 2], [1, 0, 2],
    ])
    expect(getBoundaryTransition(groups[0]!.slots[1]!, groups[1]!.slots[0])).toEqual({ off: [], on: [] })
  })

  it('shows fractional substitution times instead of rounding to the wrong minute', () => {
    expect(formatMinute(7.5)).toBe("7.5'")
    expect(formatMinute(10)).toBe("10'")
  })
})
