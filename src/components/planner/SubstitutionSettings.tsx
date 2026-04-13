import type { SportConfig, KeeperMode } from '../../types'
import { NumberStepper } from '../common/NumberStepper'
import { Card } from '../common/Card'

interface SubstitutionSettingsProps {
  sportConfig: SportConfig
  subsPerPeriod: number
  keeperMode: KeeperMode
  onSubsChange: (n: number) => void
  onKeeperModeChange: (mode: KeeperMode) => void
}

export function SubstitutionSettings({
  sportConfig,
  subsPerPeriod,
  keeperMode,
  onSubsChange,
  onKeeperModeChange,
}: SubstitutionSettingsProps) {
  const segmentsPerPeriod = subsPerPeriod + 1
  const segmentDuration = sportConfig.periodDurationMinutes / segmentsPerPeriod
  const segmentLabel = Number.isInteger(segmentDuration)
    ? `${segmentDuration} min`
    : `${segmentDuration.toFixed(1)} min`

  return (
    <Card>
      <h3 className="font-semibold text-sm text-slate-700 mb-3">Substitution settings</h3>
      <div className="space-y-4">
        <NumberStepper
          label={`Substitutions per ${sportConfig.periodCount > 1 ? 'half' : 'period'}`}
          value={subsPerPeriod}
          min={0}
          max={sportConfig.periodDurationMinutes - 1}
          onChange={onSubsChange}
        />
        <p className="text-xs text-slate-500">
          → {segmentsPerPeriod} segments × {segmentLabel} per {sportConfig.periodCount > 1 ? 'half' : 'period'}
        </p>

        {sportConfig.hasKeeper && (
          <div>
            <p className="text-sm text-slate-600 mb-2">Keeper</p>
            <div className="flex gap-2">
              {(['rotating', 'fixed'] as KeeperMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onKeeperModeChange(mode)}
                  className={[
                    'flex-1 py-2 text-sm rounded-xl border font-medium transition-colors min-touch',
                    keeperMode === mode
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50',
                  ].join(' ')}
                >
                  {mode === 'rotating' ? 'Rotating' : 'Fixed'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
