import type { TimeSlot, SportConfig, Player } from '../../types'

interface TimelineProps {
  slots: TimeSlot[]
  sportConfig: SportConfig
  players: Player[]
}

const groupBg: Record<string, string> = {
  keeper:     'bg-yellow-200 text-yellow-900',
  defender:   'bg-blue-200 text-blue-900',
  midfielder: 'bg-green-200 text-green-900',
  forward:    'bg-red-200 text-red-900',
  other:      'bg-slate-200 text-slate-700',
}

function fmtMin(m: number) {
  return `${Math.floor(m)}'`
}

export function Timeline({ slots, sportConfig, players }: TimelineProps) {
  if (slots.length === 0) return null

  const playerById = new Map(players.map((p) => [p.id, p]))

  // Compute field minutes per player
  const fieldMinutes = new Map<string, number>()
  for (const p of players) fieldMinutes.set(p.id, 0)
  for (const slot of slots) {
    const dur = slot.endMinute - slot.startMinute
    for (const playerId of Object.values(slot.assignments)) {
      if (playerId) fieldMinutes.set(playerId, (fieldMinutes.get(playerId) ?? 0) + dur)
    }
  }
  const totalMatchMinutes = sportConfig.periodCount * sportConfig.periodDurationMinutes

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse min-w-full">
        <thead>
          <tr>
            <th className="text-left py-1.5 pr-3 font-semibold text-slate-600 sticky left-0 bg-slate-50 z-10 min-w-[6rem]">
              Player
            </th>
            {slots.map((slot) => (
              <th key={slot.id} className="py-1.5 px-1 text-center font-medium text-slate-500 whitespace-nowrap min-w-[3.5rem]">
                {fmtMin(slot.startMinute)}
              </th>
            ))}
            <th className="py-1.5 px-2 text-center font-semibold text-slate-600 min-w-[3rem]">Min</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => {
            const mins = fieldMinutes.get(player.id) ?? 0
            const pct = totalMatchMinutes > 0 ? Math.round((mins / totalMatchMinutes) * 100) : 0

            return (
              <tr key={player.id} className="border-t border-slate-200">
                <td className="py-1.5 pr-3 font-medium text-slate-800 sticky left-0 bg-white z-10 truncate max-w-[6rem]">
                  {player.name}
                </td>
                {slots.map((slot) => {
                  const slotEntry = Object.entries(slot.assignments).find(([, pid]) => pid === player.id)
                  if (!slotEntry) {
                    // on bench
                    return (
                      <td key={slot.id} className="py-1 px-1 text-center">
                        <span className="inline-block w-full h-6 rounded bg-slate-100 text-slate-400 text-xs leading-6 text-center">
                          —
                        </span>
                      </td>
                    )
                  }
                  const [slotId] = slotEntry
                  const lineupSlot = sportConfig.lineupSlots.find((ls) => ls.slotId === slotId)
                  const posType = lineupSlot
                    ? sportConfig.positionTypes.find((pt) => pt.id === lineupSlot.positionTypeId)
                    : undefined
                  const bg = groupBg[posType?.group ?? 'other'] ?? groupBg.other

                  return (
                    <td key={slot.id} className="py-1 px-1 text-center">
                      <span className={['inline-block w-full h-6 rounded text-xs font-semibold leading-6 text-center', bg].join(' ')}>
                        {posType?.shortLabel ?? '?'}
                      </span>
                    </td>
                  )
                })}
                <td className="py-1.5 px-2 text-center font-semibold text-slate-700">
                  {Math.round(mins)}'
                  <span className="block text-slate-400 font-normal">{pct}%</span>
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-300">
            <td className="py-1.5 pr-3 text-xs font-semibold text-slate-500 sticky left-0 bg-slate-50 z-10">
              Period
            </td>
            {slots.map((slot) => (
              <td key={slot.id} className="py-1 px-1 text-center text-xs text-slate-400">
                {slot.periodIndex + 1}
              </td>
            ))}
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
