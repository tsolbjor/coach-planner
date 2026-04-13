import type { TimeSlot, SportConfig, Player } from '../../types'

interface SlotCardProps {
  slot: TimeSlot
  sportConfig: SportConfig
  players: Player[]
  playerMinutes: Map<string, number>
  totalMinutes: number
  onEdit: () => void
}

const groupColors: Record<string, string> = {
  keeper:     'bg-yellow-100 text-yellow-800',
  defender:   'bg-blue-100 text-blue-800',
  midfielder: 'bg-green-100 text-green-800',
  forward:    'bg-red-100 text-red-800',
  other:      'bg-slate-100 text-slate-700',
}

function fmtMin(m: number) {
  const min = Math.floor(m)
  const sec = Math.round((m - min) * 60)
  return sec > 0 ? `${min}:${String(sec).padStart(2, '0')}` : `${min}'`
}

export function SlotCard({ slot, sportConfig, players, playerMinutes, totalMinutes, onEdit }: SlotCardProps) {
  const playerById = new Map(players.map((p) => [p.id, p]))

  return (
    <button
      type="button"
      onClick={onEdit}
      className={[
        'w-full text-left bg-white border rounded-2xl p-3 transition-all hover:shadow-md active:scale-99 active:shadow-sm',
        slot.locked ? 'border-blue-300 ring-1 ring-blue-200' : 'border-slate-200',
      ].join(' ')}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-500">
          {fmtMin(slot.startMinute)} – {fmtMin(slot.endMinute)}
          {slot.periodIndex === 1 ? '' : ''}
        </span>
        <div className="flex items-center gap-1">
          {slot.locked && (
            <svg className="w-3.5 h-3.5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
          )}
          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </div>
      </div>

      {/* Lineup grid */}
      <div className="flex flex-wrap gap-1 mb-2">
        {sportConfig.lineupSlots.map((lineupSlot) => {
          const posType = sportConfig.positionTypes.find((pt) => pt.id === lineupSlot.positionTypeId)
          const playerId = slot.assignments[lineupSlot.slotId] ?? null
          const player = playerId ? playerById.get(playerId) : undefined
          const colors = groupColors[posType?.group ?? 'other'] ?? groupColors.other

          return (
            <div key={lineupSlot.slotId} className={['rounded-lg px-2 py-0.5 text-xs font-medium', colors].join(' ')}>
              <span className="opacity-60">{lineupSlot.label} </span>
              <span>{player?.name ?? '—'}</span>
            </div>
          )
        })}
      </div>

      {/* Bench */}
      {slot.bench.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-2 border-t border-slate-100">
          <span className="text-xs text-slate-400 self-center">Bench:</span>
          {slot.bench.map((id) => {
            const p = playerById.get(id)
            if (!p) return null
            const mins = playerMinutes.get(id) ?? 0
            const pct = totalMinutes > 0 ? Math.round((mins / totalMinutes) * 100) : 0
            return (
              <span key={id} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">
                {p.name} <span className="text-slate-400">{pct}%</span>
              </span>
            )
          })}
        </div>
      )}
    </button>
  )
}
