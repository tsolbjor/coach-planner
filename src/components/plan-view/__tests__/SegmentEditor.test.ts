import { describe, expect, it } from 'vitest'
import type { SegmentPin, TimeSlot } from '../../../types'
import { buildSwapPinUpdates } from '../SegmentEditor'

function makeSlot(overrides: Partial<TimeSlot> = {}): TimeSlot {
  return {
    id: 's1',
    matchIndex: 0,
    periodIndex: 0,
    startMinute: 0,
    endMinute: 5,
    gkId: 'p1',
    fieldIds: ['p2', 'p3', 'p4', 'p5'],
    benchIds: ['p6', 'p7'],
    absentIds: [],
    absentCreditedIds: [],
    positions: {},
    ...overrides,
  }
}

describe('buildSwapPinUpdates', () => {
  it('keeps a subbed-off player benched into the next stint in in-game mode', () => {
    const slots = [
      makeSlot(),
      makeSlot({ id: 's2', startMinute: 5, endMinute: 10, fieldIds: ['p2', 'p3', 'p4', 'p6'], benchIds: ['p5', 'p7'] }),
    ]
    const updates = buildSwapPinUpdates({
      slots,
      pins: {},
      segmentIndex: 0,
      selectedPlayerId: 'p2',
      otherPlayerId: 'p6',
      interactionMode: 'in-game',
    })

    expect(updates[0]).toEqual({
      gkId: 'p1',
      fieldIds: ['p3', 'p4', 'p5', 'p6'],
      benchIds: ['p7', 'p2'],
    })
    expect(updates[1]).toEqual({ benchIds: ['p2'] })
  })

  it('does not force the next stint in plan mode', () => {
    const slots = [makeSlot(), makeSlot({ id: 's2', startMinute: 5, endMinute: 10 })]
    const updates = buildSwapPinUpdates({
      slots,
      pins: {},
      segmentIndex: 0,
      selectedPlayerId: 'p2',
      otherPlayerId: 'p6',
      interactionMode: 'plan',
    })

    expect(updates[1]).toBeUndefined()
  })

  it('does not carry benching across a period boundary', () => {
    const slots = [
      makeSlot(),
      makeSlot({ id: 's2', periodIndex: 1, startMinute: 20, endMinute: 25 }),
    ]
    const updates = buildSwapPinUpdates({
      slots,
      pins: {},
      segmentIndex: 0,
      selectedPlayerId: 'p2',
      otherPlayerId: 'p6',
      interactionMode: 'in-game',
    })

    expect(updates[1]).toBeUndefined()
  })

  it('merges with an existing next-segment pin', () => {
    const slots = [makeSlot(), makeSlot({ id: 's2', startMinute: 5, endMinute: 10 })]
    const pins: Record<number, SegmentPin> = {
      1: { benchIds: ['p7'], absentIds: ['p8'], gkId: 'p1' },
    }
    const updates = buildSwapPinUpdates({
      slots,
      pins,
      segmentIndex: 0,
      selectedPlayerId: 'p2',
      otherPlayerId: 'p6',
      interactionMode: 'in-game',
    })

    expect(updates[1]).toEqual({
      benchIds: ['p7', 'p2'],
      absentIds: ['p8'],
      gkId: 'p1',
    })
  })
})
