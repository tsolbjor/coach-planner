import type { SportConfig } from '../../types'
import { NumberStepper } from '../common/NumberStepper'
import { Card } from '../common/Card'

interface SubstitutionSettingsProps {
  sportConfig: SportConfig
  benchStintMinutes: number
  matchCount: number
  onBenchStintChange: (n: number) => void
  onMatchCountChange: (n: number) => void
  onPositionRotateChange: (positionTypeId: string, rotateEveryMinutes: number) => void
}

export function SubstitutionSettings({
  sportConfig,
  benchStintMinutes,
  matchCount,
  onBenchStintChange,
  onMatchCountChange,
  onPositionRotateChange,
}: SubstitutionSettingsProps) {
  const segmentsPerPeriod = Math.max(1, Math.round(sportConfig.periodDurationMinutes / benchStintMinutes))
  const actualStint = sportConfig.periodDurationMinutes / segmentsPerPeriod
  const stintLabel = Number.isInteger(actualStint) ? `${actualStint} min` : `${actualStint.toFixed(1)} min`
  const periodWord = sportConfig.periodCount > 1 ? 'half' : 'period'
  const totalMatchMinutes = sportConfig.periodCount * sportConfig.periodDurationMinutes

  return (
    <Card>
      <h3 className="font-semibold text-sm text-slate-700 mb-3">Substitution settings</h3>
      <div className="space-y-4">
        <NumberStepper
          label="Minutes on bench"
          value={benchStintMinutes}
          min={1}
          max={sportConfig.periodDurationMinutes}
          suffix=" min"
          onChange={onBenchStintChange}
        />
        <p className="text-xs text-slate-500">
          → {segmentsPerPeriod} segment{segmentsPerPeriod !== 1 ? 's' : ''} × {stintLabel} per {periodWord}
        </p>

        <div className="border-t border-slate-100 pt-4">
          <NumberStepper
            label="Matches"
            value={matchCount}
            min={1}
            max={10}
            onChange={onMatchCountChange}
          />
        </div>

        {sportConfig.hasKeeper && (
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <div>
              <p className="text-sm font-medium text-slate-700">Rotate by role</p>
              <p className="text-xs text-slate-500">Set how long a player should stay in each role before rotating.</p>
            </div>
            <div className="space-y-2">
              {sportConfig.positionTypes.filter((p) => p.isKeeper).map((position) => (
                <NumberStepper
                  key={position.id}
                  label={position.label}
                  value={position.rotateEveryMinutes}
                  min={0}
                  max={totalMatchMinutes}
                  suffix=" min"
                  onChange={(value) => onPositionRotateChange(position.id, value)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
