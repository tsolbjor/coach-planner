import { useEffect, useState } from 'react'
import type { Player, SportConfig } from '../../types'
import { PositionBadge } from './PositionBadge'

interface PlayerListItemProps {
  player?: Player
  sportConfig: SportConfig
  absent?: boolean
  suggestedName?: string
  suggestedNumber?: number
  onDelete: () => void
  onToggleAbsent?: () => void
  onSave: (data: Omit<Player, 'id'>) => void
}

export function PlayerListItem({
  player,
  sportConfig,
  absent,
  suggestedName,
  suggestedNumber,
  onDelete,
  onToggleAbsent,
  onSave,
}: PlayerListItemProps) {
  const [name, setName] = useState(player?.name ?? suggestedName ?? '')
  const [number, setNumber] = useState(player?.number?.toString() ?? suggestedNumber?.toString() ?? '')
  const [excluded, setExcluded] = useState<string[]>(player?.excludedPositionTypeIds ?? [])

  useEffect(() => {
    setName(player?.name ?? suggestedName ?? '')
    setNumber(player?.number?.toString() ?? suggestedNumber?.toString() ?? '')
    setExcluded(player?.excludedPositionTypeIds ?? [])
  }, [player, suggestedName, suggestedNumber])

  const commit = (overrides?: Partial<{ name: string; number: string; excluded: string[] }>) => {
    const nextName = overrides?.name ?? name
    const nextNumber = overrides?.number ?? number
    const nextExcluded = overrides?.excluded ?? excluded
    const finalName = nextName.trim() || suggestedName || `Player ${suggestedNumber ?? ''}`

    onSave({
      name: finalName.trim(),
      number: nextNumber ? parseInt(nextNumber, 10) : undefined,
      excludedPositionTypeIds: nextExcluded,
    })
  }

  const togglePosition = (id: string) => {
    const nextExcluded = excluded.includes(id)
      ? excluded.filter((positionId) => positionId !== id)
      : [...excluded, id]
    setExcluded(nextExcluded)
    commit({ excluded: nextExcluded })
  }

  return (
    <div
      className={[
        'border-b border-slate-100 py-3 last:border-0',
        absent ? 'rounded-xl bg-amber-50/70 opacity-70' : '',
      ].join(' ')}
    >
      <div className="overflow-x-auto">
        <div className="flex min-w-max items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">
            {number || '#'}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => commit()}
              placeholder="Name"
              className="w-44 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              onBlur={() => commit()}
              placeholder="#"
              min={1}
              max={99}
              className="w-16 rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {sportConfig.positionTypes.map((position) => (
              <PositionBadge
                key={position.id}
                position={position}
                selected={!excluded.includes(position.id)}
                onClick={() => togglePosition(position.id)}
                size="sm"
              />
            ))}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1">
            {onToggleAbsent && (
              <button
                onClick={onToggleAbsent}
                title={absent ? 'Mark present' : 'Mark absent'}
                className={[
                  'min-touch flex items-center justify-center rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
                  absent
                    ? 'border-amber-300 bg-amber-100 text-amber-800'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700',
                ].join(' ')}
              >
                {absent ? 'Absent' : 'Active'}
              </button>
            )}
            <button
              onClick={onDelete}
              className="min-touch flex items-center justify-center rounded-lg p-2 text-red-400 hover:bg-red-50"
              aria-label="Remove player"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
