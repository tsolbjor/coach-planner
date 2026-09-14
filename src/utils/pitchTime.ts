import type { TimeSlot } from '../types'
import { getSlotIntervals } from './slotIntervals'

export function getSlotPitchMinutesByPlayer(slot: TimeSlot): Map<string, number> {
  const minutes = new Map<string, number>()
  for (const interval of getSlotIntervals(slot)) {
    const duration = interval.endMinute - interval.startMinute
    if (duration <= 0) continue
    const credited = new Set([
      ...interval.absentCreditedIds,
      ...(interval.gkId ? [interval.gkId] : []),
      ...interval.fieldIds,
    ])
    for (const id of credited) minutes.set(id, (minutes.get(id) ?? 0) + duration)
  }
  return minutes
}

export function getPlayerPitchMinutesForSlot(slot: TimeSlot, playerId: string): number {
  return getSlotPitchMinutesByPlayer(slot).get(playerId) ?? 0
}

export function getPlayerPitchMinutes(slots: TimeSlot[], playerId: string): number {
  return slots.reduce((total, slot) => total + getPlayerPitchMinutesForSlot(slot, playerId), 0)
}
