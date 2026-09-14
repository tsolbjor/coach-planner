import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { nanoid } from 'nanoid'
import { DEFAULT_PLAYER_LEVEL } from '../types'
import { useSavedPlansStore } from '../store'
import type { MatchPlan, SportConfig } from '../types'
import { AppShell } from '../components/common/AppShell'
import { Button } from '../components/common/Button'
import { Card } from '../components/common/Card'
import { NumberStepper } from '../components/common/NumberStepper'
import { buildTopFlowItems } from '../components/common/TopFlowNav'
import { ModalShell } from '../components/plan-modals/ModalShell'
import { SubstitutionSettings } from '../components/setup/SubstitutionSettings'
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

interface CreateConfig {
  name: string
  sportConfig: SportConfig
  totalPlayers: number
  benchStintMinutes: number
  matchCount: number
  changeKeeperMidPeriod: boolean
  maxBenchSegments: number
  minSubsPerSegment: number
  maxSubsPerSegment: number
}

function CreatePlanModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (config: CreateConfig) => void
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
  const [benchStintMinutes, setBenchStintMinutes] = useState(5)
  const [matchCount, setMatchCount] = useState(1)
  const [changeKeeperMidPeriod, setChangeKeeperMidPeriod] = useState(false)
  const [maxBenchSegments, setMaxBenchSegments] = useState(1)
  const [minSubsPerSegment, setMinSubsPerSegment] = useState(0)
  const [planName, setPlanName] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [labelOverrides, setLabelOverrides] = useState<Record<number, string>>({})

  const benchSize = Math.max(0, totalPlayers - size.size)
  const [maxSubsPerSegment, setMaxSubsPerSegment] = useState(Math.max(1, benchSize))

  const pickSport = (next: SportPreset) => {
    const nextSize = next.sizes[0]!
    setSport(next)
    setSize(nextSize)
    setLineup(nextSize.lineups[0]!)
    setTotalPlayers(nextSize.defaultTotalKids)
    setPeriodCount(nextSize.defaultPeriodCount)
    setPeriodDuration(nextSize.defaultPeriodMinutes)
    setLabelOverrides({})
  }

  const pickSize = (next: SportSize) => {
    setSize(next)
    setLineup(next.lineups[0]!)
    setTotalPlayers(next.defaultTotalKids)
    setPeriodCount(next.defaultPeriodCount)
    setPeriodDuration(next.defaultPeriodMinutes)
    setLabelOverrides({})
  }

  const pickLineup = (lu: Lineup) => {
    setLineup(lu)
    setLabelOverrides({})
  }

  const baseConfig = buildSportConfigFromLineup(sport, size, lineup)
  const previewSlots = baseConfig.lineupSlots.map((slot, index) => ({
    ...slot,
    label: labelOverrides[index] ?? slot.label,
  }))

  const handleCreate = () => {
    onCreate({
      name: planName.trim() || `Match ${new Date().toLocaleDateString()}`,
      sportConfig: {
        ...baseConfig,
        periodCount,
        periodDurationMinutes: periodDuration,
        benchSize: Math.max(0, totalPlayers - size.size),
        lineupSlots: previewSlots,
      },
      totalPlayers,
      benchStintMinutes: Math.min(benchStintMinutes, periodDuration),
      matchCount,
      changeKeeperMidPeriod,
      maxBenchSegments,
      minSubsPerSegment: Math.min(minSubsPerSegment, maxSubsPerSegment, benchSize),
      maxSubsPerSegment: Math.min(maxSubsPerSegment, Math.max(1, benchSize)),
    })
  }

  return (
    <ModalShell title="Pick a starting point" eyebrow="Create plan" onClose={onClose} maxWidth="lg">
      <div className="space-y-5">
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
                  <ChipButton key={lu.id} active={lu.id === lineup.id} onClick={() => pickLineup(lu)}>
                    {lu.label}
                  </ChipButton>
                ))}
              </div>
              <p className="text-xs text-slate-500">D-M-F (defenders – midfielders – forwards).</p>
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
          <NumberStepper
            label="Period duration (min)"
            value={periodDuration}
            min={5}
            max={60}
            onChange={setPeriodDuration}
          />
          <p className="text-xs text-slate-500">{benchSize} on bench.</p>
        </Card>

        <SubstitutionSettings
          sportConfig={{ ...baseConfig, periodCount, periodDurationMinutes: periodDuration }}
          benchStintMinutes={Math.min(benchStintMinutes, periodDuration)}
          matchCount={matchCount}
          changeKeeperMidPeriod={changeKeeperMidPeriod}
          maxBenchSegments={maxBenchSegments}
          minSubsPerSegment={Math.min(minSubsPerSegment, benchSize)}
          maxSubsPerSegment={Math.min(maxSubsPerSegment, Math.max(1, benchSize))}
          benchSize={benchSize}
          onBenchStintChange={setBenchStintMinutes}
          onMatchCountChange={setMatchCount}
          onChangeKeeperMidPeriodChange={setChangeKeeperMidPeriod}
          onMaxBenchSegmentsChange={setMaxBenchSegments}
          onMinSubsPerSegmentChange={setMinSubsPerSegment}
          onMaxSubsPerSegmentChange={setMaxSubsPerSegment}
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
              {previewSlots.map((slot, index) => (
                <div key={slot.slotId} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-5 shrink-0 text-xs tabular-nums text-slate-400">{index + 1}</span>
                  <input
                    type="text"
                    value={slot.label}
                    onChange={(event) =>
                      setLabelOverrides((prev) => ({ ...prev, [index]: event.target.value }))
                    }
                    disabled={index === 0}
                    className={[
                      'flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
                      index === 0
                        ? 'border-yellow-200 bg-yellow-50 text-yellow-900'
                        : 'border-slate-300 bg-white',
                    ].join(' ')}
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
    </ModalShell>
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
  const { items, setCurrentMatch, createMatch, deleteSaved } = useSavedPlansStore()
  const [creating, setCreating] = useState(false)

  const matchPlans = useMemo(
    () =>
      items
        .filter((item): item is { kind: 'match'; plan: MatchPlan } => item.kind === 'match')
        .map((item) => item.plan),
    [items],
  )

  const handleOpenPlan = (planId: string) => {
    setCurrentMatch(planId)
    navigate(`/plan/${planId}`)
  }

  const handleCreate = (config: CreateConfig) => {
    const roster = Array.from({ length: config.totalPlayers }, (_, index) => ({
      id: nanoid(8),
      name: `Player ${index + 1}`,
      level: DEFAULT_PLAYER_LEVEL,
      excludedPositionTypeIds: [] as string[],
    }))
    const plan = createMatch({
      name: config.name,
      sportConfig: config.sportConfig,
      roster,
      slots: [],
      benchStintMinutes: config.benchStintMinutes,
      matchCount: config.matchCount,
      absentPlayerIds: [],
      pins: {},
      changeKeeperMidPeriod: config.changeKeeperMidPeriod,
      maxBenchSegments: config.maxBenchSegments,
      minSubsPerSegment: config.minSubsPerSegment,
      maxSubsPerSegment: config.maxSubsPerSegment,
    })
    setCreating(false)
    navigate(`/plan/${plan.id}`)
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
            <p className="text-sm font-medium text-slate-500">
              {matchPlans.length} plan{matchPlans.length !== 1 ? 's' : ''}
            </p>
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
