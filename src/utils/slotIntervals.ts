import type { TimeSlot } from '../types'

/** Compatibility boundary for saved plans created before flat keeper intervals. */
export function getSlotIntervals(slot: TimeSlot): TimeSlot[] {
  const { midSwap, ...interval } = slot
  if (!midSwap) return [slot]
  const atMinute = Math.max(slot.startMinute, Math.min(slot.endMinute, midSwap.atMinute))
  const intervals: TimeSlot[] = []
  if (atMinute > slot.startMinute) {
    intervals.push({
      ...interval,
      id: `${slot.id}:pre`,
      endMinute: atMinute,
      gkId: midSwap.preGkId,
      fieldIds: midSwap.preFieldIds,
      benchIds: midSwap.preBenchIds,
      positions: midSwap.prePositions,
    })
  }
  if (atMinute < slot.endMinute) {
    intervals.push({ ...interval, startMinute: atMinute })
  }
  return intervals
}

export function expandSlotEntries(slots: TimeSlot[]): { slot: TimeSlot; index: number }[] {
  return slots.flatMap((slot, index) => getSlotIntervals(slot).map((interval) => ({ slot: interval, index })))
}

export function formatMinute(minute: number): string {
  return `${Number(minute.toFixed(1))}'`
}

export function groupSlotsByPeriod(slots: TimeSlot[]) {
  const groups = new Map<string, { matchIndex: number; periodIndex: number; slots: TimeSlot[] }>()
  for (const { slot } of expandSlotEntries(slots)) {
    const key = `${slot.matchIndex}:${slot.periodIndex}`
    const group = groups.get(key) ?? { matchIndex: slot.matchIndex, periodIndex: slot.periodIndex, slots: [] }
    group.slots.push(slot)
    groups.set(key, group)
  }
  return [...groups.values()]
}
