import type { Player, SportConfig } from '../../types'
import { PositionBadge } from './PositionBadge'

interface PlayerListItemProps {
  player: Player
  sportConfig: SportConfig
  absent?: boolean
  onEdit: () => void
  onDelete: () => void
  onToggleAbsent?: () => void
}

export function PlayerListItem({ player, sportConfig, absent, onEdit, onDelete, onToggleAbsent }: PlayerListItemProps) {
  const preferredTypes = sportConfig.positionTypes.filter((pt) =>
    player.preferredPositionTypeIds.includes(pt.id),
  )

  return (
    <div className={['flex items-center gap-3 py-3 border-b border-slate-100 last:border-0', absent ? 'opacity-40' : ''].join(' ')}>
      {/* Number badge */}
      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
        {player.number ?? '#'}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-sm truncate">{player.name}</span>
          {player.isFixedKeeper && (
            <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded-md font-medium">GK</span>
          )}
          {player.canBeKeeper && !player.isFixedKeeper && (
            <span className="text-xs bg-yellow-50 text-yellow-600 px-1.5 py-0.5 rounded-md">can GK</span>
          )}
        </div>
        {preferredTypes.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {preferredTypes.map((pt) => (
              <PositionBadge key={pt.id} position={pt} selected size="sm" />
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {onToggleAbsent && (
          <button
            onClick={onToggleAbsent}
            title={absent ? 'Mark present' : 'Mark absent'}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 min-touch flex items-center justify-center"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {absent
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              }
            </svg>
          </button>
        )}
        <button
          onClick={onEdit}
          className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 min-touch flex items-center justify-center"
          aria-label="Edit player"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          onClick={onDelete}
          className="p-2 rounded-lg text-red-400 hover:bg-red-50 min-touch flex items-center justify-center"
          aria-label="Remove player"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  )
}
