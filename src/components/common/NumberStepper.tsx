import { useEffect, useState } from 'react'

interface NumberStepperProps {
  value: number
  min?: number
  max?: number
  step?: number
  onChange: (value: number) => void
  label?: string
  suffix?: string
}

function decimalsFor(value: number): number {
  const str = String(value)
  const dot = str.indexOf('.')
  return dot === -1 ? 0 : str.length - dot - 1
}

function formatValue(value: number, precision: number): string {
  if (Number.isInteger(value)) return String(value)
  const fixed = value.toFixed(precision)
  return fixed
    .replace(/(\.\d*?[1-9])0+$/, '$1')
    .replace(/\.0+$/, '')
}

export function NumberStepper({
  value,
  min = 0,
  max = 99,
  step = 1,
  onChange,
  label,
  suffix,
}: NumberStepperProps) {
  const precision = Math.max(decimalsFor(step), decimalsFor(min), decimalsFor(max))
  const clamp = (next: number) => {
    const clamped = Math.min(max, Math.max(min, next))
    return Number(clamped.toFixed(precision))
  }

  const [draft, setDraft] = useState(() => formatValue(value, precision))
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused) setDraft(formatValue(value, precision))
  }, [value, precision, focused])

  const commit = (raw: string) => {
    const trimmed = raw.trim()
    if (trimmed === '' || trimmed === '-' || trimmed === '.') {
      setDraft(formatValue(value, precision))
      return
    }
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed)) {
      setDraft(formatValue(value, precision))
      return
    }
    const clamped = clamp(parsed)
    setDraft(formatValue(clamped, precision))
    if (clamped !== value) onChange(clamped)
  }

  return (
    <div className="flex items-center gap-3">
      {label && <span className="text-sm text-slate-600 flex-1">{label}</span>}
      <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => onChange(clamp(value - step))}
          disabled={value <= min}
          className="px-3 py-2 text-slate-600 hover:bg-slate-100 active:bg-slate-200 disabled:opacity-30 min-touch flex items-center justify-center"
          aria-label="Decrease"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        <label className="flex items-center px-2 py-2 min-w-[3rem]">
          <input
            type="number"
            inputMode="decimal"
            value={draft}
            min={min}
            max={max}
            step={step}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={(e) => {
              setFocused(true)
              e.target.select()
            }}
            onBlur={(e) => {
              setFocused(false)
              commit(e.target.value)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commit((e.target as HTMLInputElement).value)
                ;(e.target as HTMLInputElement).blur()
              }
              if (e.key === 'Escape') {
                setDraft(formatValue(value, precision))
                ;(e.target as HTMLInputElement).blur()
              }
            }}
            className="w-full bg-transparent text-center font-semibold tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          {suffix && <span className="text-xs font-normal text-slate-500 ml-0.5">{suffix}</span>}
        </label>
        <button
          type="button"
          onClick={() => onChange(clamp(value + step))}
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
