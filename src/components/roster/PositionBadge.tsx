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
        'rounded-lg border font-medium transition-all',
        base,
        onClick ? 'cursor-pointer hover:opacity-80 active:scale-95' : 'cursor-default',
        selected ? colors + ' ring-2 ring-offset-1 ring-current' : colors + ' opacity-50',
      ].join(' ')}
      aria-pressed={onClick ? selected : undefined}
    >
      {position.shortLabel}
    </button>
  )
}
