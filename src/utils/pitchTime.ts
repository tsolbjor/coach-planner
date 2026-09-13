import type { TimeSlot } from '../types'

function pitchFractionForRoleChange(slot: TimeSlot, playerId: string): number {
  const swap = slot.midSwap
  if (!swap) return 0
  const duration = slot.endMinute - slot.startMinute
  if (duration <= 0) return 0
  const preDuration = Math.max(0, Math.min(duration, swap.atMinute - slot.startMinute))
  const postDuration = duration - preDuration
  const preOnField = swap.preGkId === playerId || swap.preFieldIds.includes(playerId)
  const postOnField = slot.gkId === playerId || slot.fieldIds.includes(playerId)
  let total = 0
  if (preOnField) total += preDuration
  if (postOnField) total += postDuration
  return total / duration
}

export function getPlayerPitchMinutesForSlot(slot: TimeSlot, playerId: string): number {
  const duration = slot.endMinute - slot.startMinute
  if (duration <= 0) return 0
  if (slot.absentCreditedIds.includes(playerId)) return duration
  if (slot.midSwap) return duration * pitchFractionForRoleChange(slot, playerId)
  return slot.gkId === playerId || slot.fieldIds.includes(playerId) ? duration : 0
}

export function getPlayerPitchMinutes(slots: TimeSlot[], playerId: string): number {
  return slots.reduce((total, slot) => total + getPlayerPitchMinutesForSlot(slot, playerId), 0)
}
