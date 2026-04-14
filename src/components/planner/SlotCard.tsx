import { useState, useEffect } from 'react'
import type { TimeSlot, SportConfig, Player } from '../../types'
import { Button } from '../common/Button'

interface SlotCardProps {
  slot: TimeSlot
  sportConfig: SportConfig
  players: Player[]
  playerMinutes: Map<string, number>
  totalMinutes: number
  isEditing: boolean
  /** playerId → position label for players coming on in the next slot */
  comingOnNextPositions?: Map<string, string>
  /** Player IDs currently on field who will leave in the next slot — shown with indicator */
  goingOffNextIds?: ReadonlySet<string>
  onEdit: () => void
  onSave: (updates: Pick<TimeSlot, 'assignments' | 'bench' | 'locked'>) => void
  onRelease: () => void
  onCancel: () => void
}

const groupColors: Record<string, string> = {
  keeper:     'bg-yellow-100 text-yellow-800',
  defender:   'bg-blue-100 text-blue-800',
  midfielder: 'bg-green-100 text-green-800',
  forward:    'bg-red-100 text-red-800',
  other:      'bg-slate-100 text-slate-700',
}

const groupColorsBordered: Record<string, string> = {
  keeper:     'bg-yellow-100 text-yellow-800 border-yellow-300',
  defender:   'bg-blue-100 text-blue-800 border-blue-300',
  midfielder: 'bg-green-100 text-green-800 border-green-300',
  forward:    'bg-red-100 text-red-800 border-red-300',
  other:      'bg-slate-100 text-slate-700 border-slate-300',
}

function fmtMin(m: number) {
  const min = Math.floor(m)
  const sec = Math.round((m - min) * 60)
  return sec > 0 ? `${min}:${String(sec).padStart(2, '0')}` : `${min}'`
}

export function SlotCard({
  slot,
  sportConfig,
  players,
  playerMinutes,
  totalMinutes,
  isEditing,
  comingOnNextPositions,
  goingOffNextIds,
  onEdit,
  onSave,
  onRelease,
  onCancel,
}: SlotCardProps) {
  const [assignments, setAssignments] = useState<Record<string, string | null>>(() => ({
    ...slot.assignments,
  }))
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)

  // Reset editor state each time editing opens
  useEffect(() => {
    if (isEditing) {
      setAssignments({ ...slot.assignments })
      setSelectedSlotId(null)
    }
  }, [isEditing, slot.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const playerById = new Map(players.map((p) => [p.id, p]))
  const assignedPlayerIds = new Set(Object.values(assignments).filter(Boolean) as string[])
  const bench = players.filter((p) => !assignedPlayerIds.has(p.id)).map((p) => p.id)

  const handleSlotClick = (slotId: string) => {
    setSelectedSlotId((prev) => (prev === slotId ? null : slotId))
  }

  const handlePlayerClick = (playerId: string) => {
    if (!selectedSlotId) return
    setAssignments((prev) => {
      const next = { ...prev }
      for (const [sid, pid] of Object.entries(next)) {
        if (pid === playerId) next[sid] = null
      }
      if (prev[selectedSlotId] === playerId) {
        next[selectedSlotId] = null
      } else {
        next[selectedSlotId] = playerId
      }
      return next
    })
    setSelectedSlotId(null)
  }

  const handleSave = () => {
    onSave({ assignments, bench, locked: true })
  }

  if (isEditing) {
    return (
      <div className="bg-white border border-blue-300 ring-1 ring-blue-200 rounded-2xl p-3 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500">
            {fmtMin(slot.startMinute)} – {fmtMin(slot.endMinute)}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onCancel}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave}>
              Save & lock
            </Button>
          </div>
        </div>

        <p className="text-xs text-slate-500">Tap a position slot, then tap a player to assign.</p>

        {/* Lineup slots */}
        <div className="space-y-1.5">
          {sportConfig.lineupSlots.map((lineupSlot) => {
            const posType = sportConfig.positionTypes.find((pt) => pt.id === lineupSlot.positionTypeId)
            const playerId = assignments[lineupSlot.slotId] ?? null
            const player = playerId ? playerById.get(playerId) : undefined
            const colors = groupColorsBordered[posType?.group ?? 'other'] ?? groupColorsBordered.other
            const isSelected = selectedSlotId === lineupSlot.slotId

            return (
              <button
                key={lineupSlot.slotId}
                type="button"
                onClick={() => handleSlotClick(lineupSlot.slotId)}
                className={[
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left',
                  isSelected
                    ? 'ring-2 ring-blue-500 border-blue-400 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300',
                ].join(' ')}
              >
                <span className={['text-xs font-semibold px-2 py-0.5 rounded-lg border', colors].join(' ')}>
                  {lineupSlot.label}
                </span>
                <span className="flex-1 text-sm font-medium text-slate-800">
                  {player ? player.name : <span className="text-slate-400 italic">Empty</span>}
                </span>
                {player && (
                  <span className="text-xs text-slate-400 tabular-nums">
                    {totalMinutes > 0
                      ? Math.round(((playerMinutes.get(player.id) ?? 0) / totalMinutes) * 100)
                      : 0}
                    %
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Player pool */}
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2">
            {selectedSlotId ? 'Pick a player for the selected slot:' : 'Bench / pool:'}
          </p>
          <div className="flex flex-wrap gap-2">
            {players.map((p) => {
              const isOnField = assignedPlayerIds.has(p.id)
              const mins = playerMinutes.get(p.id) ?? 0
              const pct = totalMinutes > 0 ? Math.round((mins / totalMinutes) * 100) : 0

              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePlayerClick(p.id)}
                  disabled={!selectedSlotId}
                  className={[
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-sm transition-all',
                    selectedSlotId
                      ? 'cursor-pointer hover:shadow-sm active:scale-95'
                      : 'cursor-default',
                    isOnField
                      ? 'bg-slate-100 border-slate-300 text-slate-500'
                      : 'bg-white border-slate-300 text-slate-800',
                  ].join(' ')}
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="text-xs text-slate-400">{pct}%</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // Read-only card (clickable to open inline editor)
  return (
    <div
      className={[
        'w-full text-left bg-white border rounded-2xl p-3 transition-all',
        slot.locked ? 'border-blue-300 ring-1 ring-blue-200' : 'border-slate-200',
      ].join(' ')}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-500">
          {fmtMin(slot.startMinute)} – {fmtMin(slot.endMinute)}
        </span>
        <div className="flex items-center gap-1.5">
          {slot.locked && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRelease() }}
              className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-100"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2h-1V7a4 4 0 00-8 0v0h2a2 2 0 014 0v2H5V7a5 5 0 010 0z" />
              </svg>
              Back to auto
            </button>
          )}
          <button
            type="button"
            onClick={onEdit}
            className="p-0.5 rounded hover:bg-slate-100 transition-colors"
          >
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Lineup grid */}
      <button
        type="button"
        onClick={onEdit}
        className="w-full text-left"
      >
      <div className="flex flex-wrap gap-1 mb-2">
        {sportConfig.lineupSlots.map((lineupSlot) => {
          const posType = sportConfig.positionTypes.find((pt) => pt.id === lineupSlot.positionTypeId)
          const playerId = slot.assignments[lineupSlot.slotId] ?? null
          const player = playerId ? playerById.get(playerId) : undefined
          const colors = groupColors[posType?.group ?? 'other'] ?? groupColors.other
          const goingOff = player && goingOffNextIds?.has(player.id)

          return (
            <div
              key={lineupSlot.slotId}
              className={[
                'rounded-lg px-2 py-0.5 text-xs font-medium',
                colors,
                goingOff ? 'ring-1 ring-amber-400' : '',
              ].join(' ')}
            >
              <span className="opacity-60">{lineupSlot.label} </span>
              <span>{player?.name ?? '—'}</span>
              {goingOff && <span className="ml-0.5">↓</span>}
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
            const incomingPos = comingOnNextPositions?.get(id)
            return (
              <span
                key={id}
                className={[
                  'text-xs px-2 py-0.5 rounded-lg font-medium',
                  incomingPos !== undefined
                    ? 'bg-green-100 text-green-800 ring-1 ring-green-300'
                    : 'bg-slate-100 text-slate-600',
                ].join(' ')}
                title={incomingPos !== undefined ? `Coming on at ${incomingPos}` : undefined}
              >
                {incomingPos !== undefined && (
                  <span className="mr-1 opacity-70">{incomingPos}</span>
                )}
                {incomingPos !== undefined && <span className="mr-0.5">▲</span>}
                {p.name} <span className={incomingPos !== undefined ? 'text-green-600' : 'text-slate-400'}>{pct}%</span>
              </span>
            )
          })}
        </div>
      )}
      </button>
    </div>
  )
}
