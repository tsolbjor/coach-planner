import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { SegmentPin, TimeSlot } from '../../../types'
import { applyAbsence, applyPresence, buildSwapPinUpdates, SegmentEditor } from '../SegmentEditor'

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
  it('shows exact fractional interval boundaries in the editor', () => {
    const html = renderToStaticMarkup(createElement(SegmentEditor, {
      slots: [makeSlot({ startMinute: 5, endMinute: 7.5 })],
      segmentIndex: 0,
      selectedPlayerId: 'p2',
      players: [],
      pins: {},
      totalOnField: 5,
      onClose: () => {},
      onSetPins: () => {},
    }))
    expect(html).toContain('5&#x27;–7.5&#x27;')
  })

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
      requiredFieldIds: ['p6'],
      requiredBenchIds: ['p2'],
    })
    expect(updates[1]).toEqual({ requiredBenchIds: ['p2'] })
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

  it.each(['absentIds', 'absentCreditedIds'] as const)(
    'does not replace a scheduled next-interval %s override with benching',
    (absenceKey) => {
      const pin: SegmentPin = { [absenceKey]: ['p2'], requiredBenchIds: ['p7'] }
      const updates = buildSwapPinUpdates({
        slots: [makeSlot(), makeSlot({ id: 's2', startMinute: 5, endMinute: 10 })],
        pins: { 1: pin },
        segmentIndex: 0,
        selectedPlayerId: 'p2',
        otherPlayerId: 'p6',
        interactionMode: 'in-game',
      })
      expect(updates[0]).toEqual({ requiredFieldIds: ['p6'], requiredBenchIds: ['p2'] })
      expect(updates[1]).toBeUndefined()
      expect(pin).toEqual({ [absenceKey]: ['p2'], requiredBenchIds: ['p7'] })
    },
  )

  it('does not override a future absence supplied by the generated interval', () => {
    const updates = buildSwapPinUpdates({
      slots: [makeSlot(), makeSlot({ id: 's2', startMinute: 5, endMinute: 10, absentIds: ['p2'] })],
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
      requiredBenchIds: ['p7', 'p2'],
      absentIds: ['p8'],
      gkId: 'p1',
    })
  })

  it('preserves unrelated overrides and removes conflicting constraints for both players', () => {
    const updates = buildSwapPinUpdates({
      slots: [makeSlot()],
      pins: { 0: { gkId: 'p1', requiredFieldIds: ['p2', 'p3'], requiredBenchIds: ['p6', 'p7'],
        absentIds: ['p6', 'p8'], absentCreditedIds: ['p2', 'p9'] } },
      segmentIndex: 0,
      selectedPlayerId: 'p2',
      otherPlayerId: 'p6',
    })
    expect(updates[0]).toEqual({
      gkId: 'p1', requiredFieldIds: ['p3', 'p6'], requiredBenchIds: ['p7', 'p2'],
      absentIds: ['p8'], absentCreditedIds: ['p9'],
    })
  })

  it('swaps keeper and bench without locking unrelated field players', () => {
    const updates = buildSwapPinUpdates({
      slots: [makeSlot()], pins: {}, segmentIndex: 0, selectedPlayerId: 'p1', otherPlayerId: 'p6',
    })
    expect(updates[0]).toEqual({ gkId: 'p6', requiredBenchIds: ['p1'] })
  })

  it('transfers credited absence when swapping with an absent player', () => {
    const updates = buildSwapPinUpdates({
      slots: [makeSlot({ absentIds: ['p8'], absentCreditedIds: ['p8'] })],
      pins: { 0: { absentIds: ['p8', 'p9'], absentCreditedIds: ['p8'] } },
      segmentIndex: 0, selectedPlayerId: 'p2', otherPlayerId: 'p8',
    })
    expect(updates[0]).toEqual({
      absentIds: ['p9'], absentCreditedIds: ['p2'], requiredFieldIds: ['p8'],
    })
  })

  it('marking absent clears targeted role conflicts; presence preserves other targeted pins', () => {
    const pin = applyAbsence({ requiredFieldIds: ['p2', 'p3'], requiredBenchIds: ['p2', 'p7'], gkId: 'p2' }, 'p2', true)
    expect(pin).toEqual({
      requiredFieldIds: ['p3'], requiredBenchIds: ['p7'], absentIds: [], absentCreditedIds: ['p2'],
    })
    expect(applyPresence(pin, 'p2')).toEqual({ requiredFieldIds: ['p3'], requiredBenchIds: ['p7'] })
  })
})
