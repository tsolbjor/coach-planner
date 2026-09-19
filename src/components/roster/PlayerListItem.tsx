import { useEffect, useState } from 'react'
import { normalizePlayerLevel, type Player, type PlayerLevel, type SportConfig } from '../../types'
import { PositionBadge } from './PositionBadge'

interface PlayerListItemProps {
  player?: Player
  sportConfig: SportConfig
  absent?: boolean
  suggestedName?: string
  onDelete: () => void
  onToggleAbsent?: () => void
  onSave: (data: Omit<Player, 'id'>) => void
}

const NAME_INPUT_CLASS = 'js-player-name-input'

function focusSiblingName(current: HTMLInputElement, delta: number) {
  const all = Array.from(document.querySelectorAll<HTMLInputElement>('.' + NAME_INPUT_CLASS))
  const idx = all.indexOf(current)
  const next = all[idx + delta]
  if (next) {
    next.focus()
    next.select()
  }
}

export function PlayerListItem({
  player,
  sportConfig,
  absent,
  suggestedName,
  onDelete,
  onToggleAbsent,
  onSave,
}: PlayerListItemProps) {
  const [name, setName] = useState(player?.name ?? suggestedName ?? '')
  const [level, setLevel] = useState<PlayerLevel>(normalizePlayerLevel(player?.level))
  const [excluded, setExcluded] = useState<string[]>(player?.excludedPositionTypeIds ?? [])

  useEffect(() => {
    setName(player?.name ?? suggestedName ?? '')
    setLevel(normalizePlayerLevel(player?.level))
    setExcluded(player?.excludedPositionTypeIds ?? [])
  }, [player, suggestedName])

  const commit = (overrides?: Partial<{ name: string; level: PlayerLevel; excluded: string[] }>) => {
    const nextName = overrides?.name ?? name
    const nextLevel = overrides?.level ?? level
    const nextExcluded = overrides?.excluded ?? excluded
    const finalName = nextName.trim() || suggestedName || 'Player'

    onSave({
      name: finalName.trim(),
      level: nextLevel,
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
      <div className="flex flex-wrap items-center gap-3 md:flex-nowrap">
        <div className="flex w-full min-w-0 items-center gap-2 md:w-auto md:shrink-0">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => commit()}
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commit()
                focusSiblingName(e.currentTarget, 1)
              }
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                commit()
                focusSiblingName(e.currentTarget, 1)
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                commit()
                focusSiblingName(e.currentTarget, -1)
              }
            }}
            placeholder="Name"
            className={[NAME_INPUT_CLASS, 'min-w-0 flex-1 md:w-44 md:flex-none rounded-lg border border-slate-300 px-3 py-1.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'].join(' ')}
          />
          <select
            value={level === 1 ? 1 : 2}
            onChange={(e) => {
              const nextLevel = normalizePlayerLevel(Number(e.target.value))
              setLevel(nextLevel)
              commit({ level: nextLevel })
            }}
            aria-label="Bench-group preference"
            title="Avoid benching more than one protected player together, when possible"
            className="w-28 shrink-0 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-blue-500"
          >
            <option value={1}>Protected</option>
            <option value={2}>Standard</option>
          </select>
        </div>

        <div className="min-w-0 flex-1 md:overflow-x-auto">
          <div className="flex flex-wrap items-center gap-1.5 md:min-w-max md:flex-nowrap">
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
        </div>

        <div className="flex shrink-0 items-center gap-1">
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
  )
}
