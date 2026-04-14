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
      <table className="w-full min-w-max border-separate border-spacing-0 text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-20 min-w-[8rem] rounded-tl-xl bg-slate-100 py-2 pr-3 text-left font-semibold text-slate-600">
              Player
            </th>
            {slots.map((slot, index) => {
              const prev = slots[index - 1]
              const matchStart = !prev || (prev.matchIndex ?? 0) !== (slot.matchIndex ?? 0)
              const periodStart = !prev || prev.periodIndex !== slot.periodIndex || matchStart
              const tint = slot.periodIndex % 2 === 0 ? 'bg-slate-100' : 'bg-blue-50'
              return (
                <th
                  key={`${slot.id}_group`}
                  className={[
                    'py-2 px-1 text-center text-[11px] font-semibold text-slate-500',
                    tint,
                    matchStart ? 'border-l-4 border-slate-300' : periodStart ? 'border-l-2 border-blue-200' : '',
                  ].join(' ')}
                >
                  {matchStart
                    ? `M${(slot.matchIndex ?? 0) + 1} · P${slot.periodIndex + 1}`
                    : periodStart
                      ? `P${slot.periodIndex + 1}`
                      : ''}
                </th>
              )
            })}
            <th className="rounded-tr-xl bg-slate-100 py-2 px-2 text-center font-semibold text-slate-600 min-w-[3.5rem]">
              Min
            </th>
          </tr>
          <tr>
            <th className="text-left py-1.5 pr-3 font-semibold text-slate-600 sticky left-0 bg-slate-50 z-10 min-w-[8rem]">
              Player
            </th>
            {slots.map((slot, index) => {
              const prev = slots[index - 1]
              const matchStart = !prev || (prev.matchIndex ?? 0) !== (slot.matchIndex ?? 0)
              const periodStart = !prev || prev.periodIndex !== slot.periodIndex || matchStart
              const tint = slot.periodIndex % 2 === 0 ? 'bg-slate-50' : 'bg-blue-50/70'
              return (
                <th
                  key={slot.id}
                  className={[
                    'py-1.5 px-1 text-center font-medium text-slate-500 whitespace-nowrap min-w-[3.1rem] lg:min-w-[2.75rem]',
                    tint,
                    matchStart ? 'border-l-4 border-slate-300' : periodStart ? 'border-l-2 border-blue-200' : '',
                  ].join(' ')}
                >
                  {fmtMin(slot.startMinute)}
                </th>
              )
            })}
            <th className="py-1.5 px-2 text-center font-semibold text-slate-600 min-w-[3rem]">Min</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => {
            const mins = fieldMinutes.get(player.id) ?? 0
            const pct = totalMatchMinutes > 0 ? Math.round((mins / totalMatchMinutes) * 100) : 0

            return (
              <tr key={player.id} className="border-t border-slate-200">
                <td className="py-1.5 pr-3 font-medium text-slate-800 sticky left-0 bg-white z-10 truncate max-w-[8rem]">
                  {player.name}
                </td>
                {slots.map((slot, index) => {
                  const prev = slots[index - 1]
                  const matchStart = !prev || (prev.matchIndex ?? 0) !== (slot.matchIndex ?? 0)
                  const periodStart = !prev || prev.periodIndex !== slot.periodIndex || matchStart
                  const tint = slot.periodIndex % 2 === 0 ? 'bg-white' : 'bg-blue-50/40'
                  const slotEntry = Object.entries(slot.assignments).find(([, pid]) => pid === player.id)
                  if (!slotEntry) {
                    // on bench
                    return (
                      <td
                        key={slot.id}
                        className={[
                          'py-1 px-1 text-center',
                          tint,
                          matchStart ? 'border-l-4 border-slate-300' : periodStart ? 'border-l-2 border-blue-200' : '',
                        ].join(' ')}
                      >
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
                    <td
                      key={slot.id}
                      className={[
                        'py-1 px-1 text-center',
                        tint,
                        matchStart ? 'border-l-4 border-slate-300' : periodStart ? 'border-l-2 border-blue-200' : '',
                      ].join(' ')}
                    >
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
            {slots.map((slot, index) => {
              const prev = slots[index - 1]
              const matchStart = !prev || (prev.matchIndex ?? 0) !== (slot.matchIndex ?? 0)
              const periodStart = !prev || prev.periodIndex !== slot.periodIndex || matchStart
              const tint = slot.periodIndex % 2 === 0 ? 'bg-slate-50' : 'bg-blue-50/70'
              return (
                <td
                  key={slot.id}
                  className={[
                    'py-1 px-1 text-center text-xs text-slate-400',
                    tint,
                    matchStart ? 'border-l-4 border-slate-300' : periodStart ? 'border-l-2 border-blue-200' : '',
                  ].join(' ')}
                >
                  {slot.periodIndex + 1}
                </td>
              )
            })}
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
