interface NumberStepperProps {
  value: number
  min?: number
  max?: number
  onChange: (value: number) => void
  label?: string
  suffix?: string
}

export function NumberStepper({ value, min = 0, max = 99, onChange, label, suffix }: NumberStepperProps) {
  return (
    <div className="flex items-center gap-3">
      {label && <span className="text-sm text-slate-600 flex-1">{label}</span>}
      <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="px-3 py-2 text-slate-600 hover:bg-slate-100 active:bg-slate-200 disabled:opacity-30 min-touch flex items-center justify-center"
          aria-label="Decrease"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        <span className="px-3 py-2 min-w-[2.5rem] text-center font-semibold tabular-nums">
          {value}{suffix ? <span className="text-xs font-normal text-slate-500 ml-0.5">{suffix}</span> : null}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="px-3 py-2 text-slate-600 hover:bg-slate-100 active:bg-slate-200 disabled:opacity-30 min-touch flex items-center justify-center"
          aria-label="Increase"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    </div>
  )
}
