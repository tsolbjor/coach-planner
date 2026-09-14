import type { TimeSlot } from '../types'

export function getSlotStartOnFieldIds(slot: TimeSlot): string[] {
  if (slot.midSwap) {
    return [slot.midSwap.preGkId, ...slot.midSwap.preFieldIds].filter((id): id is string => !!id)
  }
  return getSlotEndOnFieldIds(slot)
}

export function getSlotEndOnFieldIds(slot: TimeSlot): string[] {
  return [slot.gkId, ...slot.fieldIds].filter((id): id is string => !!id)
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
