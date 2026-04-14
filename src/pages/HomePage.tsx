import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { nanoid } from 'nanoid'
import { useSavedPlansStore, useSettingsStore } from '../store'
import type { MatchPlan, SportConfig } from '../types'
import { AppShell } from '../components/common/AppShell'
import { Button } from '../components/common/Button'
import { Card } from '../components/common/Card'
import { NumberStepper } from '../components/common/NumberStepper'
import { buildTopFlowItems } from '../components/common/TopFlowNav'

type PositionRow = { id: string; label: string }

type Preset = {
  id: string
  sport: string
  size: number
  positions: string[]
  totalKids: number
  periodCount: number
  periodDurationMinutes: number
}

const PRESETS: Preset[] = [
  {
    id: 'soccer6',
    sport: 'Soccer',
    size: 6,
    positions: ['GK', 'LB', 'CB', 'RB', 'CM', 'ST'],
    totalKids: 8,
    periodCount: 2,
    periodDurationMinutes: 20,
  },
  {
    id: 'soccer7',
    sport: 'Soccer',
    size: 7,
    positions: ['GK', 'LB', 'CB', 'RB', 'CM', 'LW', 'ST'],
    totalKids: 9,
    periodCount: 2,
    periodDurationMinutes: 25,
  },
  {
    id: 'soccer9',
    sport: 'Soccer',
    size: 9,
    positions: ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'RM', 'ST'],
    totalKids: 12,
    periodCount: 2,
    periodDurationMinutes: 30,
  },
  {
    id: 'soccer11',
    sport: 'Soccer',
    size: 11,
    positions: ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'RM', 'LW', 'RW', 'ST'],
    totalKids: 14,
    periodCount: 2,
    periodDurationMinutes: 45,
  },
  {
    id: 'handball6',
    sport: 'Handball',
    size: 6,
    positions: ['GK', 'LW', 'LB', 'CB', 'RB', 'RW'],
    totalKids: 9,
    periodCount: 2,
    periodDurationMinutes: 20,
  },
  {
    id: 'handball7',
    sport: 'Handball',
    size: 7,
    positions: ['GK', 'LW', 'LB', 'CB', 'RB', 'RW', 'PV'],
    totalKids: 10,
    periodCount: 2,
    periodDurationMinutes: 20,
  },
]

function makeRow(index: number): PositionRow {
  return {
    id: `pos_${nanoid(4)}`,
    label: index === 0 ? 'GK' : `P${index + 1}`,
  }
}

function rowsFromPreset(preset: Preset): PositionRow[] {
  return preset.positions.map((label, index) => ({
    id: `pos_${nanoid(4)}`,
    label: index === 0 ? 'GK' : label,
  }))
}

function ensurePositionCount(rows: PositionRow[], count: number): PositionRow[] {
  const sliced = rows.slice(0, count)
  const next = [...sliced]
  while (next.length < count) next.push(makeRow(next.length))
  return next.map((row, index) => ({
    ...row,
    label: index === 0 ? 'GK' : row.label,
  }))
}

function buildSportConfig(
  presetId: SportConfig['presetId'],
  positions: PositionRow[],
  totalKids: number,
  periodCount: number,
  periodDurationMinutes: number,
): SportConfig {
  const normalizedPositions = positions.map((position, index) => ({
    ...position,
    label: index === 0 ? 'GK' : position.label.trim() || `P${index + 1}`,
  }))
  const bench = Math.max(0, totalKids - normalizedPositions.length)

  return {
    presetId,
    name: `${normalizedPositions.length}-a-side`,
    totalOnField: normalizedPositions.length,
    benchSize: bench,
    periodCount,
    periodDurationMinutes,
    hasKeeper: true,
    positionTypes: normalizedPositions.map((position, index) => ({
      id: position.id,
      label: position.label,
      shortLabel: position.label.slice(0, 4),
      group: index === 0 ? ('keeper' as const) : ('other' as const),
      isKeeper: index === 0,
      rotateEveryMinutes: 0,
    })),
    lineupSlots: normalizedPositions.map((position) => ({
      slotId: position.id,
      positionTypeId: position.id,
      label: position.label,
    })),
  }
}

function planDate(plan: MatchPlan) {
  return new Date(plan.updatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

function CreatePlanModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (config: {
    name: string
    sportConfig: SportConfig
    totalPlayers: number
  }) => void
}) {
  const { sportConfig } = useSettingsStore()
  const initialPreset = PRESETS.find((preset) => preset.size === sportConfig.totalOnField) ?? PRESETS[1]!
  const [activePresetId, setActivePresetId] = useState(initialPreset.id)
  const [positions, setPositions] = useState<PositionRow[]>(() => rowsFromPreset(initialPreset))
  const [totalPlayers, setTotalPlayers] = useState(initialPreset.totalKids)
  const [periodCount, setPeriodCount] = useState(initialPreset.periodCount)
  const [periodDuration, setPeriodDuration] = useState(initialPreset.periodDurationMinutes)
  const [planName, setPlanName] = useState('')

  const selectedPreset = PRESETS.find((preset) => preset.id === activePresetId) ?? initialPreset
  const onField = positions.length
  const benchSize = Math.max(0, totalPlayers - onField)

  const applyPreset = (preset: Preset) => {
    setActivePresetId(preset.id)
    setPositions(rowsFromPreset(preset))
    setTotalPlayers(preset.totalKids)
    setPeriodCount(preset.periodCount)
    setPeriodDuration(preset.periodDurationMinutes)
  }

  const handleOnFieldChange = (value: number) => {
    setActivePresetId('custom')
    setPositions((prev) => ensurePositionCount(prev, value))
    setTotalPlayers((prev) => Math.max(prev, value))
  }

  const handleLabelChange = (id: string, label: string) => {
    setPositions((prev) => prev.map((position, index) => (
      position.id === id
        ? { ...position, label: index === 0 ? 'GK' : label }
        : position
    )))
  }

  const handleCreate = () => {
    const nextSportConfig = buildSportConfig(
      selectedPreset.id.startsWith('custom') ? 'custom' : 'custom',
      positions,
      totalPlayers,
      periodCount,
      periodDuration,
    )

    onCreate({
      name: planName.trim() || `Match ${new Date().toLocaleDateString()}`,
      sportConfig: nextSportConfig,
      totalPlayers,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 p-3 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.25)]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Create Plan</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">Start From A Preset</h2>
          </div>
          <Button size="sm" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
          <div className="space-y-5 lg:grid lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)] lg:gap-6 lg:space-y-0">
            <div className="space-y-5">
              <Card className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">Preset</p>
                  <div className="flex flex-wrap gap-2">
                    {PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className={[
                          'rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                          activePresetId === preset.id
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-slate-300 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700',
                        ].join(' ')}
                      >
                        {preset.sport} {preset.size}
                      </button>
                    ))}
                  </div>
                </div>

                <NumberStepper
                  label="Players on field"
                  value={onField}
                  min={1}
                  max={15}
                  onChange={handleOnFieldChange}
                />
                <NumberStepper
                  label="Total players"
                  value={totalPlayers}
                  min={onField}
                  max={30}
                  onChange={setTotalPlayers}
                />
                <NumberStepper
                  label="Periods"
                  value={periodCount}
                  min={1}
                  max={4}
                  onChange={setPeriodCount}
                />
                <NumberStepper
                  label="Period duration (min)"
                  value={periodDuration}
                  min={5}
                  max={60}
                  onChange={setPeriodDuration}
                />

                <p className="text-xs text-slate-500">
                  {benchSize} on bench. The first position is always goalkeeper.
                </p>
              </Card>

              <Card padding={false}>
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="text-sm font-medium text-slate-800">Position names</p>
                  <p className="mt-1 text-xs text-slate-500">These become the editable roles in the plan.</p>
                </div>
                <div className="divide-y divide-slate-100">
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
              </Card>
            </div>

            <div className="space-y-5">
              <Card className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-slate-800">Plan details</p>
                  <p className="mt-1 text-xs text-slate-500">The planner will open on Rotation Setup after creation.</p>
                </div>
                <input
                  type="text"
                  value={planName}
                  onChange={(event) => setPlanName(event.target.value)}
                  placeholder={`Match ${new Date().toLocaleDateString()}`}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Button fullWidth size="lg" onClick={handleCreate}>
                  Create plan
                </Button>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function HomePage() {
  const navigate = useNavigate()
  const { setSportConfig } = useSettingsStore()
  const { items, setCurrentMatch, createMatch, deleteSaved } = useSavedPlansStore()
  const [creating, setCreating] = useState(false)

  const matchPlans = useMemo(
    () => items.filter((item): item is { kind: 'match'; plan: MatchPlan } => item.kind === 'match').map((item) => item.plan),
    [items],
  )

  const handleOpenPlan = (planId: string) => {
    setCurrentMatch(planId)
    navigate(`/plan/${planId}?step=planner`)
  }

  const handleCreate = ({
    name,
    sportConfig,
    totalPlayers,
  }: {
    name: string
    sportConfig: SportConfig
    totalPlayers: number
  }) => {
    setSportConfig(sportConfig)
    const roster = Array.from({ length: totalPlayers }, (_, index) => ({
      id: nanoid(8),
      name: `Player ${index + 1}`,
      number: index + 1,
      excludedPositionTypeIds: [] as string[],
    }))
    const plan = createMatch({
      name,
      sportConfig,
      roster,
      slots: [],
      benchStintMinutes: 5,
      matchCount: 1,
      absentPlayerIds: [],
    })
    setCreating(false)
    navigate(`/plan/${plan.id}?step=planner`)
  }

  return (
    <AppShell flowItems={buildTopFlowItems(undefined, 'home')} width="wide">
      <div className="space-y-6">
        <div className="text-center pt-4">
          <h1 className="text-2xl font-bold text-slate-900">Coach Planner</h1>
          <p className="mt-1 text-sm text-slate-500">Rotation plans for your team</p>
        </div>

        <div className="flex justify-center">
          <Button size="lg" onClick={() => setCreating(true)}>
            Create new plan
          </Button>
        </div>

        {matchPlans.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-500">{matchPlans.length} plan{matchPlans.length !== 1 ? 's' : ''}</p>
            {matchPlans.map((plan) => (
              <Card
                key={plan.id}
                className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <button
                  type="button"
                  onClick={() => handleOpenPlan(plan.id)}
                  className="min-w-0 text-left"
                >
                  <p className="truncate text-base font-semibold text-slate-900">{plan.name}</p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {plan.sportConfig.name} · {plan.roster.length} players · {planDate(plan)}
                  </p>
                </button>

                <div className="flex shrink-0 gap-2">
                  <Button variant="secondary" onClick={() => handleOpenPlan(plan.id)}>
                    Open
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      if (confirm(`Delete "${plan.name}"?`)) deleteSaved(plan.id)
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {creating && <CreatePlanModal onClose={() => setCreating(false)} onCreate={handleCreate} />}
    </AppShell>
  )
}
