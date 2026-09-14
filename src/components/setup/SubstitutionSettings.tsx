import type { SportConfig } from '../../types'
import { NumberStepper } from '../common/NumberStepper'
import { Card } from '../common/Card'

interface SubstitutionSettingsProps {
  sportConfig: SportConfig
  benchStintMinutes: number
  matchCount: number
  changeKeeperMidPeriod: boolean
  maxBenchSegments: number
  minSubsPerSegment: number
  maxSubsPerSegment: number
  benchSize: number
  onBenchStintChange: (n: number) => void
  onMatchCountChange: (n: number) => void
  onChangeKeeperMidPeriodChange: (next: boolean) => void
  onMaxBenchSegmentsChange: (n: number) => void
  onMinSubsPerSegmentChange: (n: number) => void
  onMaxSubsPerSegmentChange: (n: number) => void
}

export function SubstitutionSettings({
  sportConfig,
  benchStintMinutes,
  matchCount,
  changeKeeperMidPeriod,
  maxBenchSegments,
  minSubsPerSegment,
  maxSubsPerSegment,
  benchSize,
  onBenchStintChange,
  onMatchCountChange,
  onChangeKeeperMidPeriodChange,
  onMaxBenchSegmentsChange,
  onMinSubsPerSegmentChange,
  onMaxSubsPerSegmentChange,
}: SubstitutionSettingsProps) {
  const segmentsPerPeriod = Math.max(1, Math.round(sportConfig.periodDurationMinutes / benchStintMinutes))
  const actualStint = sportConfig.periodDurationMinutes / segmentsPerPeriod
  const stintLabel = Number.isInteger(actualStint) ? `${actualStint} min` : `${actualStint.toFixed(1)} min`
  const periodWord = sportConfig.periodCount > 1 ? 'half' : 'period'
  const totalSegments = segmentsPerPeriod * sportConfig.periodCount
  const benchSpots = Math.max(1, benchSize)

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

        <div className="border-t border-slate-100 pt-4 space-y-3">
          <NumberStepper
            label="Max segments on bench"
            value={maxBenchSegments}
            min={1}
            max={Math.max(1, totalSegments)}
            onChange={onMaxBenchSegmentsChange}
          />
          <NumberStepper
            label="Min subs per segment"
            value={minSubsPerSegment}
            min={0}
            max={benchSpots}
            onChange={onMinSubsPerSegmentChange}
          />
          <NumberStepper
            label="Max subs per segment"
            value={maxSubsPerSegment}
            min={Math.max(1, minSubsPerSegment)}
            max={benchSpots}
            onChange={onMaxSubsPerSegmentChange}
          />
          <p className="text-xs text-slate-500">
            These are fairness/churn guidelines: looser caps allow longer bench runs, while hard lineup limits are still preserved.
          </p>
        </div>

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
                  Swap keeper with a benched player at the midpoint of each period when a bench keeper is available. Old keeper goes to the bench and rejoins normal rotation next segment.
                </p>
              </div>
            </label>
          </div>
        )}
      </div>
    </Card>
  )
}
