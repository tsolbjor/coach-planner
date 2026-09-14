import type { TimeSlot } from '../types'
import { getSlotIntervals } from './slotIntervals'

export function getSlotStartOnFieldIds(slot: TimeSlot): string[] {
  const first = getSlotIntervals(slot)[0]
  return first ? getSlotEndOnFieldIds(first) : []
}

export function getSlotEndOnFieldIds(slot: TimeSlot): string[] {
  const intervals = getSlotIntervals(slot)
  const last = intervals[intervals.length - 1]
  return last ? [last.gkId, ...last.fieldIds].filter((id): id is string => !!id) : []
}

export function getBoundaryTransition(currentSlot: TimeSlot, nextSlot?: TimeSlot | null) {
  if (!nextSlot || nextSlot.matchIndex !== currentSlot.matchIndex) {
    return { off: [], on: [] }
  }

  const currentOnIds = getSlotEndOnFieldIds(currentSlot)
  const nextOnIds = getSlotStartOnFieldIds(nextSlot)
  const nextOnSet = new Set(nextOnIds)
  const currentOnSet = new Set(currentOnIds)

  return {
    off: currentOnIds.filter((id) => !nextOnSet.has(id)),
    on: nextOnIds.filter((id) => !currentOnSet.has(id)),
  }
}
