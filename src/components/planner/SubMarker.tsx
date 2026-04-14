import type { TimeSlot, SportConfig } from '../../types'

/**
 * Returns a Map<playerId, positionLabel> for players coming on in `nextSlot`.
 * Uses the lineup slot label from sportConfig.
 */
export function buildComingOnPositions(
  nextSlot: TimeSlot,
  comingOnIds: string[],
  sportConfig: SportConfig,
): Map<string, string> {
  const result = new Map<string, string>()
  const comingOnSet = new Set(comingOnIds)
  for (const [slotId, playerId] of Object.entries(nextSlot.assignments)) {
    if (!playerId || !comingOnSet.has(playerId)) continue
    const ls = sportConfig.lineupSlots.find((l) => l.slotId === slotId)
    if (ls) result.set(playerId, ls.label)
  }
  return result
}

export function computeSubDiff(prev: TimeSlot, next: TimeSlot) {
  const prevField = new Set(Object.values(prev.assignments).filter(Boolean) as string[])
  const nextField = new Set(Object.values(next.assignments).filter(Boolean) as string[])
  return {
    comingOn: [...nextField].filter((id) => !prevField.has(id)),
    goingOff: [...prevField].filter((id) => !nextField.has(id)),
  }
}


