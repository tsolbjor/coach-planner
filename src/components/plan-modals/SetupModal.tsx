import { useState } from 'react'
import type { MatchPlan } from '../../types'
import { useSavedPlansStore } from '../../store'
import { Card } from '../common/Card'
import { NumberStepper } from '../common/NumberStepper'
import { Button } from '../common/Button'
import { SubstitutionSettings } from '../setup/SubstitutionSettings'
import { ModalShell } from './ModalShell'
import {
  rowsFromSportConfig,
  ensurePositionCount,
  buildSportConfigFromRows,
  buildRosterForTotalPlayers,
  type PositionRow,
} from './positionRows'
import { DEFAULT_PLAYER_LEVEL } from '../../types'

interface SetupModalProps {
  plan: MatchPlan
  onClose: () => void
}

export function SetupModal({ plan, onClose }: SetupModalProps) {
  const { updateMatch } = useSavedPlansStore()
  const [showAdvanced, setShowAdvanced] = useState(false)

  const positions = rowsFromSportConfig(plan.sportConfig)
  const totalPlayers = plan.roster.length
  const periodCount = plan.sportConfig.periodCount
  const periodDuration = plan.sportConfig.periodDurationMinutes
  const onField = positions.length
  const benchSize = Math.max(0, totalPlayers - onField)

  const applySetup = (
    nextPositions: PositionRow[],
    nextTotalPlayers: number,
    nextPeriodCount: number,
    nextPeriodDuration: number,
  ) => {
    const nextSportConfig = buildSportConfigFromRows(
      nextPositions,
      nextTotalPlayers,
      nextPeriodCount,
      nextPeriodDuration,
    )
    const validPositionTypeIds = new Set(nextSportConfig.positionTypes.map((p) => p.id))
    const resizedRoster = buildRosterForTotalPlayers(plan.roster, nextTotalPlayers, DEFAULT_PLAYER_LEVEL).map(
      (player) => ({
        ...player,
        excludedPositionTypeIds: player.excludedPositionTypeIds.filter((id) => validPositionTypeIds.has(id)),
      }),
    )
    const validRosterIds = new Set(resizedRoster.map((p) => p.id))

    updateMatch(plan.id, {
      sportConfig: nextSportConfig,
      roster: resizedRoster,
      absentPlayerIds: plan.absentPlayerIds.filter((id) => validRosterIds.has(id)),
      benchStintMinutes: Math.min(plan.benchStintMinutes, nextPeriodDuration),
      slots: [],
      pins: {},
    })
  }

  const handleOnFieldChange = (value: number) => {
    const nextPositions = ensurePositionCount(positions, value)
    const nextTotal = Math.max(totalPlayers, value)
    applySetup(nextPositions, nextTotal, periodCount, periodDuration)
  }

  const handleLabelChange = (id: string, label: string) => {
    const nextPositions = positions.map((position, index) =>
      position.id === id ? { ...position, label: index === 0 ? 'GK' : label } : position,
    )
    applySetup(nextPositions, totalPlayers, periodCount, periodDuration)
  }

  return (
    <ModalShell title="Setup" eyebrow="Plan settings" onClose={onClose} maxWidth="lg">
      <div className="space-y-5">
        <Card className="space-y-4">
          <NumberStepper label="Players on field" value={onField} min={1} max={15} onChange={handleOnFieldChange} />
          <NumberStepper
            label="Total players"
            value={totalPlayers}
            min={onField}
            max={30}
            onChange={(v) => applySetup(positions, v, periodCount, periodDuration)}
          />
          <NumberStepper
            label="Periods"
            value={periodCount}
            min={1}
            max={4}
            onChange={(v) => applySetup(positions, totalPlayers, v, periodDuration)}
          />
          <NumberStepper
            label="Period duration (min)"
            value={periodDuration}
            min={5}
            max={60}
            onChange={(v) => applySetup(positions, totalPlayers, periodCount, v)}
          />
          <p className="text-xs text-slate-500">
            {benchSize} on bench. First position is always goalkeeper.
          </p>
        </Card>

        <SubstitutionSettings
          sportConfig={plan.sportConfig}
          benchStintMinutes={plan.benchStintMinutes}
          matchCount={plan.matchCount}
          changeKeeperMidPeriod={plan.changeKeeperMidPeriod}
          maxBenchSegments={plan.maxBenchSegments}
          minSubsPerSegment={plan.minSubsPerSegment}
          maxSubsPerSegment={plan.maxSubsPerSegment}
          benchSize={benchSize}
          onBenchStintChange={(v) => updateMatch(plan.id, { benchStintMinutes: v })}
          onMatchCountChange={(v) => updateMatch(plan.id, { matchCount: v })}
          onChangeKeeperMidPeriodChange={(v) => updateMatch(plan.id, { changeKeeperMidPeriod: v })}
          onMaxBenchSegmentsChange={(v) => updateMatch(plan.id, { maxBenchSegments: v })}
          onMinSubsPerSegmentChange={(v) => updateMatch(plan.id, { minSubsPerSegment: v })}
          onMaxSubsPerSegmentChange={(v) => updateMatch(plan.id, { maxSubsPerSegment: v })}
        />

        <Card padding={false}>
          <button
            type="button"
            onClick={() => setShowAdvanced((s) => !s)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <span className="text-sm font-semibold text-slate-700">Advanced · position names</span>
            <span className="text-xs text-slate-400">{showAdvanced ? 'Hide' : 'Show'}</span>
          </button>
          {showAdvanced && (
            <div className="divide-y divide-slate-100 border-t border-slate-100">
              {positions.map((position, index) => (
                <div key={position.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-5 shrink-0 text-xs tabular-nums text-slate-400">{index + 1}</span>
                  <input
                    type="text"
                    value={position.label}
                    onChange={(event) => handleLabelChange(position.id, event.target.value)}
                    disabled={index === 0}
                    className={[
                      'flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
                      index === 0
                        ? 'border-yellow-200 bg-yellow-50 text-yellow-900'
                        : 'border-slate-300 bg-white',
                    ].join(' ')}
                    placeholder={index === 0 ? 'GK' : `P${index + 1}`}
                  />
                  {index === 0 && (
                    <span className="rounded-md border border-yellow-300 bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-800">
                      GK
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Button fullWidth variant="secondary" onClick={onClose}>
          Done
        </Button>
      </div>
    </ModalShell>
  )
}
