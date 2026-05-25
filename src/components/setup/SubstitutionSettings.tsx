import type { SportConfig } from '../../types'
import { NumberStepper } from '../common/NumberStepper'
import { Card } from '../common/Card'

interface SubstitutionSettingsProps {
  sportConfig: SportConfig
  benchStintMinutes: number
  matchCount: number
  changeKeeperMidPeriod: boolean
  onBenchStintChange: (n: number) => void
  onMatchCountChange: (n: number) => void
  onChangeKeeperMidPeriodChange: (next: boolean) => void
}

export function SubstitutionSettings({
  sportConfig,
  benchStintMinutes,
  matchCount,
  changeKeeperMidPeriod,
  onBenchStintChange,
  onMatchCountChange,
  onChangeKeeperMidPeriodChange,
}: SubstitutionSettingsProps) {
  const segmentsPerPeriod = Math.max(1, Math.round(sportConfig.periodDurationMinutes / benchStintMinutes))
  const actualStint = sportConfig.periodDurationMinutes / segmentsPerPeriod
  const stintLabel = Number.isInteger(actualStint) ? `${actualStint} min` : `${actualStint.toFixed(1)} min`
  const periodWord = sportConfig.periodCount > 1 ? 'half' : 'period'

  return (
    <Card>
      <h3 className="font-semibold text-sm text-slate-700 mb-3">Substitution settings</h3>
      <div className="space-y-4">
        <NumberStepper
          label="Minutes on bench"
          value={benchStintMinutes}
          min={0.5}
          max={sportConfig.periodDurationMinutes}
          step={0.5}
          suffix=" min"
          onChange={onBenchStintChange}
        />
        <p className="text-xs text-slate-500">
          → {segmentsPerPeriod} segment{segmentsPerPeriod !== 1 ? 's' : ''} × {stintLabel} per {periodWord}
        </p>

        <div className="border-t border-slate-100 pt-4">
          <NumberStepper label="Matches" value={matchCount} min={1} max={10} onChange={onMatchCountChange} />
        </div>

        {sportConfig.hasKeeper && (
          <div className="border-t border-slate-100 pt-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={changeKeeperMidPeriod}
                onChange={(e) => onChangeKeeperMidPeriodChange(e.target.checked)}
                className="mt-1 h-4 w-4"
              />
              <div>
                <p className="text-sm font-medium text-slate-700">Change keeper mid-period</p>
                <p className="text-xs text-slate-500">
                  Swap keeper with a benched player at the midpoint of each period. Old keeper goes to the bench and rejoins normal rotation next segment.
                </p>
              </div>
            </label>
          </div>
        )}
      </div>
    </Card>
  )
}
