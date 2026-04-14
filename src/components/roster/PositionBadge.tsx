import type { PositionType } from '../../types'

const groupColors: Record<string, string> = {
  keeper:     'bg-yellow-100 text-yellow-800 border-yellow-300',
  defender:   'bg-blue-100 text-blue-800 border-blue-300',
  midfielder: 'bg-green-100 text-green-800 border-green-300',
  forward:    'bg-red-100 text-red-800 border-red-300',
  other:      'bg-slate-100 text-slate-700 border-slate-300',
}

interface PositionBadgeProps {
  position: PositionType
  selected?: boolean
  onClick?: () => void
  size?: 'sm' | 'md'
}

export function PositionBadge({ position, selected = false, onClick, size = 'md' }: PositionBadgeProps) {
  const colors = groupColors[position.group] ?? groupColors.other
  const base = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={[
        'inline-flex items-center gap-1 rounded-lg border font-medium transition-all',
        base,
        onClick ? 'cursor-pointer hover:-translate-y-px active:translate-y-0' : 'cursor-default',
        selected
          ? colors + ' shadow-sm ring-1 ring-offset-1 ring-current/20'
          : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300 hover:text-slate-500',
      ].join(' ')}
      aria-pressed={onClick ? selected : undefined}
      title={selected ? `${position.label} enabled` : `${position.label} disabled`}
    >
      <span
        className={[
          'inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold',
          selected ? 'bg-white/70 text-current' : 'bg-slate-100 text-slate-400',
        ].join(' ')}
        aria-hidden="true"
      >
        {selected ? '✓' : '−'}
      </span>
      {position.shortLabel}
    </button>
  )
}
