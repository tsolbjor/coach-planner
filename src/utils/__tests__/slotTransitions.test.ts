import { describe, expect, it } from 'vitest'
import type { TimeSlot } from '../../types'
import { getBoundaryTransition, getSlotStartOnFieldIds } from '../slotTransitions'

function makeSlot(overrides: Partial<TimeSlot>): TimeSlot {
  return {
    id: 'slot',
    matchIndex: 0,
    periodIndex: 0,
    startMinute: 0,
    endMinute: 5,
    gkId: null,
    fieldIds: [],
    benchIds: [],
    absentIds: [],
    absentCreditedIds: [],
    positions: {},
    ...overrides,
  }
}

describe('slotTransitions', () => {
  it('uses the next slot pre-swap lineup for boundary substitutions', () => {
    const current = makeSlot({
      gkId: 'p1',
      fieldIds: ['p2', 'p3'],
      benchIds: ['p4'],
    })
    const next = makeSlot({
      startMinute: 5,
      endMinute: 10,
      gkId: 'p3',
      fieldIds: ['p2', 'p4'],
      benchIds: ['p1'],
      midSwap: {
        atMinute: 7.5,
        preGkId: 'p1',
        preFieldIds: ['p2', 'p4'],
        preBenchIds: ['p3'],
        prePositions: {},
      },
    })

    expect(getSlotStartOnFieldIds(next)).toEqual(['p1', 'p2', 'p4'])
    expect(getBoundaryTransition(current, next)).toEqual({
      off: ['p3'],
      on: ['p4'],
    })
  })
})
