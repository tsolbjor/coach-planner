import { describe, expect, it } from 'vitest'
import { getAdjacentEntry, type SlotEntry } from '../planPageNavigation'

function makeEntry(index: number, matchIndex: number, periodIndex: number): SlotEntry {
  return {
    index,
    slot: { matchIndex, periodIndex },
  }
}

describe('getAdjacentEntry', () => {
  const slotEntries = [
    makeEntry(0, 0, 0),
    makeEntry(1, 0, 0),
    makeEntry(2, 0, 1),
    makeEntry(3, 1, 0),
  ]

  it('moves to the next period when the current period ends', () => {
    expect(getAdjacentEntry(slotEntries, slotEntries[1]!, 1)).toEqual(slotEntries[2])
  })

  it('moves to the next match when the current match ends', () => {
    expect(getAdjacentEntry(slotEntries, slotEntries[2]!, 1)).toEqual(slotEntries[3])
  })

  it('moves back across period and match boundaries', () => {
    expect(getAdjacentEntry(slotEntries, slotEntries[2]!, -1)).toEqual(slotEntries[1])
    expect(getAdjacentEntry(slotEntries, slotEntries[3]!, -1)).toEqual(slotEntries[2])
  })

  it('returns null at the ends of the plan', () => {
    expect(getAdjacentEntry(slotEntries, slotEntries[0]!, -1)).toBeNull()
    expect(getAdjacentEntry(slotEntries, slotEntries[3]!, 1)).toBeNull()
  })
})
