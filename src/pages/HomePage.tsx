import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { nanoid } from 'nanoid'
import { DEFAULT_PLAYER_LEVEL } from '../types'
import { useSavedPlansStore, useSettingsStore } from '../store'
import type { MatchPlan, SportConfig } from '../types'
import { AppShell } from '../components/common/AppShell'
import { Button } from '../components/common/Button'
import { Card } from '../components/common/Card'
import { NumberStepper } from '../components/common/NumberStepper'
import { buildTopFlowItems } from '../components/common/TopFlowNav'
import {
  SPORT_PRESETS,
  buildSportConfigFromLineup,
  type Lineup,
  type SportPreset,
  type SportSize,
} from '../constants/sportPresets'

function planDate(plan: MatchPlan) {
  return new Date(plan.updatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

function CreatePlanModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (config: { name: string; sportConfig: SportConfig; totalPlayers: number }) => void
}) {
  const initialSport = SPORT_PRESETS[0]!
  const initialSize = initialSport.sizes.find((s) => s.size === 11) ?? initialSport.sizes[0]!
  const initialLineup = initialSize.lineups[0]!

  const [sport, setSport] = useState<SportPreset>(initialSport)
  const [size, setSize] = useState<SportSize>(initialSize)
  const [lineup, setLineup] = useState<Lineup>(initialLineup)
  const [totalPlayers, setTotalPlayers] = useState(initialSize.defaultTotalKids)
  const [periodCount, setPeriodCount] = useState(initialSize.defaultPeriodCount)
  const [periodDuration, setPeriodDuration] = useState(initialSize.defaultPeriodMinutes)
  const [planName, setPlanName] = useState('')

  const benchSize = Math.max(0, totalPlayers - size.size)

  const pickSport = (next: SportPreset) => {
    const nextSize = next.sizes[0]!
    setSport(next)
    setSize(nextSize)
    setLineup(nextSize.lineups[0]!)
    setTotalPlayers(nextSize.defaultTotalKids)
    setPeriodCount(nextSize.defaultPeriodCount)
    setPeriodDuration(nextSize.defaultPeriodMinutes)
  }

  const pickSize = (next: SportSize) => {
    setSize(next)
    setLineup(next.lineups[0]!)
    setTotalPlayers(next.defaultTotalKids)
    setPeriodCount(next.defaultPeriodCount)
    setPeriodDuration(next.defaultPeriodMinutes)
  }

  const handleCreate = () => {
    const nextSportConfig = buildSportConfigFromLineup(sport, size, lineup)
    onCreate({
      name: planName.trim() || `Match ${new Date().toLocaleDateString()}`,
      sportConfig: {
        ...nextSportConfig,
        periodCount,
        periodDurationMinutes: periodDuration,
        benchSize: Math.max(0, totalPlayers - size.size),
      },
      totalPlayers,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 p-3 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.25)]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Create plan</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">Pick a starting point</h2>
          </div>
          <Button size="sm" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="space-y-5 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
          <Card className="space-y-4">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Sport</p>
              <div className="flex flex-wrap gap-2">
                {SPORT_PRESETS.map((s) => (
                  <ChipButton key={s.id} active={s.id === sport.id} onClick={() => pickSport(s)}>
                    {s.name}
                  </ChipButton>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Players on field</p>
              <div className="flex flex-wrap gap-2">
                {sport.sizes.map((sz) => (
                  <ChipButton key={sz.size} active={sz.size === size.size} onClick={() => pickSize(sz)}>
                    {sz.size}-a-side
                  </ChipButton>
                ))}
              </div>
            </div>

            {size.lineups.length > 1 && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Formation</p>
                <div className="flex flex-wrap gap-2">
                  {size.lineups.map((lu) => (
                    <ChipButton key={lu.id} active={lu.id === lineup.id} onClick={() => setLineup(lu)}>
                      {lu.label}
                    </ChipButton>
                  ))}
                </div>
                <p className="text-xs text-slate-500">D-M-F (defenders – midfielders – forwards). Position names editable later on Setup page.</p>
              </div>
            )}
          </Card>

          <Card className="space-y-4">
            <NumberStepper
              label="Total players"
              value={totalPlayers}
              min={size.size}
              max={30}
              onChange={setTotalPlayers}
            />
            <NumberStepper label="Periods" value={periodCount} min={1} max={4} onChange={setPeriodCount} />
            <NumberStepper label="Period duration (min)" value={periodDuration} min={5} max={60} onChange={setPeriodDuration} />
            <p className="text-xs text-slate-500">{benchSize} on bench.</p>
          </Card>

          <Card className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Plan name</p>
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
  )
}

function ChipButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'border-blue-600 bg-blue-600 text-white'
          : 'border-slate-300 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700',
      ].join(' ')}
    >
      {children}
    </button>
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
      level: DEFAULT_PLAYER_LEVEL,
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
      pins: {},
      changeKeeperMidPeriod: false,
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
