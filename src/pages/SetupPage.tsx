import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettingsStore } from '../store'
import { SPORT_PRESETS } from '../constants/sportPresets'
import type { SportConfig } from '../types'
import { PageHeader } from '../components/common/PageHeader'
import { Card } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { NumberStepper } from '../components/common/NumberStepper'

export function SetupPage() {
  const navigate = useNavigate()
  const { sportConfig, setSportConfig } = useSettingsStore()
  const [selected, setSelected] = useState<SportConfig>(sportConfig)
  const [customising, setCustomising] = useState(false)

  const handlePreset = (preset: SportConfig) => {
    setSelected(preset)
    setCustomising(false)
  }

  const handleConfirm = () => {
    setSportConfig(selected)
    navigate('/roster')
  }

  return (
    <div className="px-4 pb-12 max-w-lg mx-auto">
      <PageHeader title="Sport setup" backTo="/" />

      {/* Presets */}
      <div className="space-y-3 mb-6">
        <p className="text-sm font-medium text-slate-600">Choose a sport</p>
        <div className="grid grid-cols-2 gap-3">
          {SPORT_PRESETS.map((preset) => (
            <button
              key={preset.presetId}
              type="button"
              onClick={() => handlePreset(preset)}
              className={[
                'rounded-2xl border p-4 text-left transition-all',
                selected.presetId === preset.presetId
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                  : 'border-slate-200 bg-white hover:border-slate-300',
              ].join(' ')}
            >
              <p className="font-semibold text-sm">{preset.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {preset.totalOnField} on field · {preset.benchSize} bench
              </p>
              <p className="text-xs text-slate-500">
                {preset.periodCount}×{preset.periodDurationMinutes} min
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Customise toggle */}
      <button
        type="button"
        onClick={() => setCustomising((v) => !v)}
        className="text-sm text-blue-600 font-medium mb-4 flex items-center gap-1"
      >
        <svg className={['w-4 h-4 transition-transform', customising ? 'rotate-90' : ''].join(' ')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Customise settings
      </button>

      {customising && (
        <Card className="mb-6 space-y-4">
          <NumberStepper
            label="Players on field"
            value={selected.totalOnField}
            min={2}
            max={15}
            onChange={(v) => setSelected((s) => ({ ...s, totalOnField: v }))}
          />
          <NumberStepper
            label="Bench size"
            value={selected.benchSize}
            min={0}
            max={10}
            onChange={(v) => setSelected((s) => ({ ...s, benchSize: v }))}
          />
          <NumberStepper
            label="Number of periods"
            value={selected.periodCount}
            min={1}
            max={4}
            onChange={(v) => setSelected((s) => ({ ...s, periodCount: v }))}
          />
          <NumberStepper
            label="Period duration (min)"
            value={selected.periodDurationMinutes}
            min={5}
            max={60}
            onChange={(v) => setSelected((s) => ({ ...s, periodDurationMinutes: v }))}
          />
        </Card>
      )}

      {/* Summary */}
      <Card className="mb-6">
        <p className="text-sm font-semibold mb-2">{selected.name}</p>
        <div className="grid grid-cols-2 gap-1 text-xs text-slate-600">
          <span>On field: <strong>{selected.totalOnField}</strong></span>
          <span>Bench: <strong>{selected.benchSize}</strong></span>
          <span>Periods: <strong>{selected.periodCount}</strong></span>
          <span>Duration: <strong>{selected.periodDurationMinutes} min</strong></span>
        </div>
        <div className="mt-3">
          <p className="text-xs font-medium text-slate-500 mb-1.5">Positions</p>
          <div className="flex flex-wrap gap-1.5">
            {selected.lineupSlots.map((ls) => (
              <span key={ls.slotId} className="text-xs bg-slate-100 px-2 py-0.5 rounded-lg text-slate-700 font-medium">
                {ls.label}
              </span>
            ))}
          </div>
        </div>
      </Card>

      <Button fullWidth size="lg" onClick={handleConfirm}>
        Continue to roster →
      </Button>
    </div>
  )
}
