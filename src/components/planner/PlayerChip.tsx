interface PlayerChipProps {
  name: string
  fieldMinutes: number
  totalMatchMinutes: number
  isKeeper?: boolean
  small?: boolean
  onClick?: () => void
  selected?: boolean
}

export function PlayerChip({ name, fieldMinutes, totalMatchMinutes, isKeeper, small, onClick, selected }: PlayerChipProps) {
  const pct = totalMatchMinutes > 0 ? Math.round((fieldMinutes / totalMatchMinutes) * 100) : 0

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={[
        'flex items-center gap-1.5 rounded-lg border transition-all text-left',
        small ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-sm',
        onClick ? 'cursor-pointer hover:shadow-sm active:scale-95' : 'cursor-default',
        selected
          ? 'bg-blue-600 text-white border-blue-600'
          : isKeeper
          ? 'bg-yellow-50 border-yellow-300 text-yellow-900'
          : 'bg-white border-slate-300 text-slate-800',
      ].join(' ')}
    >
      <span className="font-medium truncate max-w-[6rem]">{name}</span>
      <span className={['tabular-nums shrink-0', selected ? 'text-blue-100' : 'text-slate-400'].join(' ')}>
        {pct}%
      </span>
    </button>
  )
}
