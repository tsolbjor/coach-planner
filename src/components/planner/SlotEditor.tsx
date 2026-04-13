import { useState } from 'react'
import type { TimeSlot, SportConfig, Player } from '../../types'
import { Modal } from '../common/Modal'
import { Button } from '../common/Button'

interface SlotEditorProps {
  slot: TimeSlot
  sportConfig: SportConfig
  players: Player[]
  playerMinutes: Map<string, number>
  totalMinutes: number
  onSave: (updates: Pick<TimeSlot, 'assignments' | 'bench' | 'locked'>) => void
  onClose: () => void
}

function fmtMin(m: number) {
  const min = Math.floor(m)
  const sec = Math.round((m - min) * 60)
  return sec > 0 ? `${min}:${String(sec).padStart(2, '0')}` : `${min}'`
}

export function SlotEditor({ slot, sportConfig, players, playerMinutes, totalMinutes, onSave, onClose }: SlotEditorProps) {
  const [assignments, setAssignments] = useState<Record<string, string | null>>({ ...slot.assignments })
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)

  const assignedPlayerIds = new Set(Object.values(assignments).filter(Boolean) as string[])
  const bench = players.filter((p) => !assignedPlayerIds.has(p.id)).map((p) => p.id)

  const playerById = new Map(players.map((p) => [p.id, p]))

  const handleSlotClick = (slotId: string) => {
    if (selectedSlotId === slotId) {
      setSelectedSlotId(null)
    } else {
      setSelectedSlotId(slotId)
    }
  }

  const handlePlayerClick = (playerId: string) => {
    if (!selectedSlotId) return

    setAssignments((prev) => {
      const next = { ...prev }
      // Remove the player from any slot they're currently in
      for (const [sid, pid] of Object.entries(next)) {
        if (pid === playerId) next[sid] = null
      }
      // If clicking the same player already in selected slot, clear it
      if (prev[selectedSlotId] === playerId) {
        next[selectedSlotId] = null
      } else {
        // Swap: if selected slot had someone, move them to bench (handled by clearing)
        next[selectedSlotId] = playerId
      }
      return next
    })
    setSelectedSlotId(null)
  }

  const handleSave = () => {
    onSave({ assignments, bench, locked: true })
    onClose()
  }

  const groupColors: Record<string, string> = {
    keeper:     'bg-yellow-100 text-yellow-800 border-yellow-300',
    defender:   'bg-blue-100 text-blue-800 border-blue-300',
    midfielder: 'bg-green-100 text-green-800 border-green-300',
    forward:    'bg-red-100 text-red-800 border-red-300',
    other:      'bg-slate-100 text-slate-700 border-slate-300',
  }

  return (
    <Modal
      title={`Edit slot ${fmtMin(slot.startMinute)}–${fmtMin(slot.endMinute)}`}
      open
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save & lock</Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-500">Tap a position slot, then tap a player to assign.</p>

        {/* Lineup slots */}
        <div className="space-y-1.5">
          {sportConfig.lineupSlots.map((lineupSlot) => {
            const posType = sportConfig.positionTypes.find((pt) => pt.id === lineupSlot.positionTypeId)
            const playerId = assignments[lineupSlot.slotId] ?? null
            const player = playerId ? playerById.get(playerId) : undefined
            const colors = groupColors[posType?.group ?? 'other'] ?? groupColors.other
            const isSelected = selectedSlotId === lineupSlot.slotId

            return (
              <button
                key={lineupSlot.slotId}
                type="button"
                onClick={() => handleSlotClick(lineupSlot.slotId)}
                className={[
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left',
                  isSelected ? 'ring-2 ring-blue-500 border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300',
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
                      : 0}%
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
                    selectedSlotId ? 'cursor-pointer hover:shadow-sm active:scale-95' : 'cursor-default',
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
    </Modal>
  )
}
