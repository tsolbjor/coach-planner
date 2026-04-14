import type { TimeSlot, Player, SportConfig } from '../../types'

interface SubMarkerProps {
  prev: TimeSlot
  next: TimeSlot
  players: Player[]
}

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

export function SubMarker({ prev, next, players }: SubMarkerProps) {
  const playerById = new Map(players.map((p) => [p.id, p]))
  const { comingOn, goingOff } = computeSubDiff(prev, next)

  if (comingOn.length === 0 && goingOff.length === 0) return null

  const name = (id: string) => playerById.get(id)?.name ?? id

  return (
    <div className="flex items-center gap-3 px-2 py-1.5 my-0.5">
      <span className="text-xs text-slate-400 font-medium whitespace-nowrap tabular-nums w-8 text-right">
        {Math.floor(next.startMinute)}'
      </span>
      <div className="flex-1 flex flex-wrap gap-x-4 gap-y-0.5">
        {comingOn.length > 0 && (
          <span className="text-xs text-green-700 font-medium">
            ▲ {comingOn.map(name).join(', ')}
          </span>
        )}
        {goingOff.length > 0 && (
          <span className="text-xs text-red-600 font-medium">
            ▼ {goingOff.map(name).join(', ')}
          </span>
        )}
      </div>
    </div>
  )
}
