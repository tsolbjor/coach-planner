import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { nanoid } from 'nanoid'
import { DEFAULT_PLAYER_LEVEL, normalizePlayerLevel } from '../types'
import { buildShareUrl } from '../utils/shareUrl'
import { generatePlan } from '../scheduler'
import { useSavedPlansStore } from '../store'
import type { MatchPlan, Player, TimeSlot } from '../types'
import { AppShell } from '../components/common/AppShell'
import { Button } from '../components/common/Button'
import { Card } from '../components/common/Card'
import { NumberStepper } from '../components/common/NumberStepper'
import { PageHeader } from '../components/common/PageHeader'
import { buildTopFlowItems } from '../components/common/TopFlowNav'
import { SlotCard } from '../components/planner/SlotCard'
import { SubstitutionSettings } from '../components/planner/SubstitutionSettings'
import { computeSubDiff, buildComingOnPositions } from '../components/planner/SubMarker'
import { PlayerListItem } from '../components/roster/PlayerListItem'

type PlanStep = 'roster' | 'planner' | 'generated'
type PositionRow = {
  id: string
  label: string
  rotateEveryMinutes: number
  group: MatchPlan['sportConfig']['positionTypes'][number]['group']
}

function getPlanStep(value: string | null): PlanStep {
  if (value === 'roster' || value === 'generated') return value
  return 'planner'
}

function makePositionRow(index: number): PositionRow {
  return {
    id: `pos_${nanoid(4)}`,
    label: index === 0 ? 'GK' : `P${index + 1}`,
    rotateEveryMinutes: 0,
    group: index === 0 ? 'keeper' : 'other',
  }
}

function rowsFromSportConfig(sportConfig: MatchPlan['sportConfig']): PositionRow[] {
  return sportConfig.lineupSlots.map((slot, index) => {
    const position = sportConfig.positionTypes.find((type) => type.id === slot.positionTypeId)
    return {
      id: slot.slotId,
      label: index === 0 ? 'GK' : (position?.label ?? slot.label),
      rotateEveryMinutes: position?.rotateEveryMinutes ?? 0,
      group: index === 0 ? 'keeper' : (position?.group ?? 'other'),
    }
  })
}

function ensurePositionCount(rows: PositionRow[], count: number): PositionRow[] {
  const sliced = rows.slice(0, count)
  const next = [...sliced]
  while (next.length < count) next.push(makePositionRow(next.length))
  return next.map((row, index) => ({
    ...row,
    label: index === 0 ? 'GK' : row.label,
    group: index === 0 ? 'keeper' : row.group,
  }))
}

function buildSportConfig(
  positions: PositionRow[],
  totalPlayers: number,
  periodCount: number,
  periodDurationMinutes: number,
): MatchPlan['sportConfig'] {
  const totalMatchMinutes = periodCount * periodDurationMinutes
  const normalizedPositions = positions.map((position, index) => ({
    ...position,
    label: index === 0 ? 'GK' : position.label.trim() || `P${index + 1}`,
    group: index === 0 ? 'keeper' : position.group,
    rotateEveryMinutes: Math.min(position.rotateEveryMinutes, totalMatchMinutes),
  }))
  const bench = Math.max(0, totalPlayers - normalizedPositions.length)

  return {
    presetId: 'custom',
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
      group: index === 0 ? ('keeper' as const) : position.group,
      isKeeper: index === 0,
      rotateEveryMinutes: index === 0 ? position.rotateEveryMinutes : 0,
    })),
    lineupSlots: normalizedPositions.map((position) => ({
      slotId: position.id,
      positionTypeId: position.id,
      label: position.label,
    })),
  }
}

function buildRosterForTotalPlayers(roster: MatchPlan['roster'], totalPlayers: number): MatchPlan['roster'] {
  if (totalPlayers <= roster.length) return roster.slice(0, totalPlayers)
  const next = [...roster]
  for (let i = roster.length; i < totalPlayers; i++) {
    next.push({
      id: nanoid(8),
      name: `Player ${i + 1}`,
      number: i + 1,
      level: DEFAULT_PLAYER_LEVEL,
      excludedPositionTypeIds: [],
    })
  }
  return next
}

function buildSlotsByMatchByPeriod(slots: TimeSlot[], matchCount: number, periodCount: number) {
  const matches: TimeSlot[][][] = Array.from({ length: matchCount }, () =>
    Array.from({ length: periodCount }, () => []),
  )

  for (const slot of slots) {
    const matchIndex = slot.matchIndex ?? 0
    matches[matchIndex]?.[slot.periodIndex]?.push(slot)
  }

  return matches
}

function buildGenerationSignature(
  sportConfig: MatchPlan['sportConfig'],
  roster: MatchPlan['roster'],
  benchStintMinutes: number,
  matchCount: number,
  absentPlayerIds: string[],
  slots: MatchPlan['slots'],
) {
  return JSON.stringify({
    benchStintMinutes,
    matchCount,
    absentPlayerIds: [...absentPlayerIds].sort(),
    positions: sportConfig.positionTypes
      .filter((position) => position.isKeeper)
      .map((position) => ({
        id: position.id,
        rotateEveryMinutes: position.rotateEveryMinutes,
      })),
    roster: roster.map((player) => ({
      id: player.id,
      level: normalizePlayerLevel(player.level),
      excludedPositionTypeIds: [...player.excludedPositionTypeIds].sort(),
    })),
    lockedSlotIds: slots.filter((s) => s.locked).map((s) => s.id).sort(),
  })
}

function EditPlanSetupModal({
  plan,
  onClose,
  onSave,
}: {
  plan: MatchPlan
  onClose: () => void
  onSave: (updates: Partial<Omit<MatchPlan, 'id' | 'createdAt'>>) => void
}) {
  const [positions, setPositions] = useState<PositionRow[]>(() => rowsFromSportConfig(plan.sportConfig))
  const [totalPlayers, setTotalPlayers] = useState(plan.roster.length)
  const [periodCount, setPeriodCount] = useState(plan.sportConfig.periodCount)
  const [periodDuration, setPeriodDuration] = useState(plan.sportConfig.periodDurationMinutes)

  const onField = positions.length
  const benchSize = Math.max(0, totalPlayers - onField)

  const handleOnFieldChange = (value: number) => {
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

  const handleSave = () => {
    const nextSportConfig = buildSportConfig(positions, totalPlayers, periodCount, periodDuration)
    const validPositionTypeIds = new Set(nextSportConfig.positionTypes.map((position) => position.id))
    const resizedRoster = buildRosterForTotalPlayers(plan.roster, totalPlayers).map((player) => ({
      ...player,
      excludedPositionTypeIds: player.excludedPositionTypeIds.filter((id) => validPositionTypeIds.has(id)),
    }))
    const validRosterIds = new Set(resizedRoster.map((player) => player.id))
    const totalMatchMinutes = periodCount * periodDuration

    onSave({
      sportConfig: {
        ...nextSportConfig,
        positionTypes: nextSportConfig.positionTypes.map((position) => ({
          ...position,
          rotateEveryMinutes: Math.min(position.rotateEveryMinutes, totalMatchMinutes),
        })),
      },
      roster: resizedRoster,
      absentPlayerIds: plan.absentPlayerIds.filter((id) => validRosterIds.has(id)),
      benchStintMinutes: Math.min(plan.benchStintMinutes, periodDuration),
      slots: [],
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 p-3 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.25)]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Plan setup</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">Edit plan settings</h2>
          </div>
          <Button size="sm" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
          <div className="space-y-5">
            <Card className="space-y-4">
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

            <Button fullWidth size="lg" onClick={handleSave}>
              Save setup
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function RosterStep({
  planId,
  plan,
}: {
  planId: string
  plan: MatchPlan
}) {
  const { addMatchPlayer, updateMatchPlayer, removeMatchPlayer, updateMatch } = useSavedPlansStore()

  const { sportConfig, roster, absentPlayerIds } = plan
  const needed = sportConfig.totalOnField + sportConfig.benchSize
  const ready = roster.length >= sportConfig.totalOnField
  const activePlayerCount = roster.length - absentPlayerIds.length

  const handleSaveNew = (data: Omit<Player, 'id'>) => {
    addMatchPlayer(planId, data)
  }

  const handleUpdate = (playerId: string, data: Omit<Player, 'id'>) => {
    updateMatchPlayer(planId, playerId, data)
  }

  const handleDelete = (playerId: string) => {
    if (confirm('Remove this player?')) removeMatchPlayer(planId, playerId)
  }

  const toggleAbsent = (playerId: string) => {
    const next = absentPlayerIds.includes(playerId)
      ? absentPlayerIds.filter((id) => id !== playerId)
      : [...absentPlayerIds, playerId]
    updateMatch(planId, { absentPlayerIds: next })
  }

  const handleGeneratePlayers = () => {
    const start = roster.length + 1
    for (let i = start; i <= needed; i++) {
      addMatchPlayer(planId, {
        name: `Player ${i}`,
        number: i,
        level: DEFAULT_PLAYER_LEVEL,
        excludedPositionTypeIds: [],
      })
    }
  }

  return (
    <div className="space-y-4">
      <div
        className={[
          'rounded-xl px-3 py-2 text-sm',
          ready ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700',
        ].join(' ')}
      >
        {roster.length} player{roster.length !== 1 ? 's' : ''} · Need {sportConfig.totalOnField} on field
        {sportConfig.benchSize > 0 ? ` + ${sportConfig.benchSize} bench (${needed} total)` : ''}
        {ready ? ' ✓' : ` — ${needed - roster.length} more needed`}
        {absentPlayerIds.length > 0 ? ` · ${activePlayerCount} active` : ''}
      </div>

      {roster.length === 0 ? (
        <div className="py-8 text-center text-slate-400">
          <p className="mb-3">No players yet</p>
          <Button onClick={handleGeneratePlayers}>Generate {needed} players</Button>
        </div>
      ) : (
        <Card padding={false}>
          <div className="px-4">
            {roster.map((player) => (
              <PlayerListItem
                key={player.id}
                player={player}
                sportConfig={sportConfig}
                absent={absentPlayerIds.includes(player.id)}
                onToggleAbsent={() => toggleAbsent(player.id)}
                onDelete={() => handleDelete(player.id)}
                onSave={(data) => handleUpdate(player.id, data)}
              />
            ))}
          </div>
        </Card>
      )}

      <Button
        size="sm"
        variant="secondary"
        onClick={() => handleSaveNew({
          name: `Player ${roster.length + 1}`,
          number: roster.length + 1,
          level: DEFAULT_PLAYER_LEVEL,
          excludedPositionTypeIds: [],
        })}
        fullWidth
      >
        + Add player
      </Button>
    </div>
  )
}

function PlannerStep({
  planId,
  plan,
  warnings,
}: {
  planId: string
  plan: MatchPlan
  warnings: string[]
}) {
  const { updateMatch } = useSavedPlansStore()
  const [editingSetup, setEditingSetup] = useState(false)

  const { sportConfig, slots, benchStintMinutes, matchCount } = plan

  const updatePositionRotate = (positionTypeId: string, rotateEveryMinutes: number) => {
    updateMatch(planId, {
      sportConfig: {
        ...sportConfig,
        positionTypes: sportConfig.positionTypes.map((position) => (
          position.id === positionTypeId ? { ...position, rotateEveryMinutes } : position
        )),
      },
    })
  }

  return (
    <div className="space-y-4">
      <Button variant="secondary" size="sm" onClick={() => setEditingSetup(true)} fullWidth>
        Edit plan setup
      </Button>

      <SubstitutionSettings
        sportConfig={sportConfig}
        benchStintMinutes={benchStintMinutes}
        matchCount={matchCount}
        onBenchStintChange={(value) => updateMatch(planId, { benchStintMinutes: value })}
        onMatchCountChange={(value) => updateMatch(planId, { matchCount: value })}
        onPositionRotateChange={updatePositionRotate}
      />

      {warnings.length > 0 && (
        <div className="space-y-1">
          {warnings.map((warning, index) => (
            <div key={index} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              {warning}
            </div>
          ))}
        </div>
      )}

      {slots.length > 0 && (
        <p className="text-xs text-slate-500">
          The plan updates automatically when players or planner settings change.
        </p>
      )}

      {editingSetup && (
        <EditPlanSetupModal
          plan={plan}
          onClose={() => setEditingSetup(false)}
          onSave={(updates) => {
            updateMatch(planId, updates)
            setEditingSetup(false)
          }}
        />
      )}
    </div>
  )
}

function GeneratedStep({
  planId,
  plan,
}: {
  planId: string
  plan: MatchPlan
}) {
  const { updateMatch, updateMatchSlot } = useSavedPlansStore()
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null)
  const [shareCopied, setShareCopied] = useState(false)

  const handleShare = () => {
    const url = buildShareUrl(plan)
    navigator.clipboard.writeText(url)
      .then(() => {
        setShareCopied(true)
        setTimeout(() => setShareCopied(false), 2000)
      })
      .catch(() => alert('Copy failed — try again'))
  }

  const { sportConfig, roster, slots, benchStintMinutes, matchCount, absentPlayerIds } = plan

  const activePlayers = useMemo(
    () => roster.filter((player) => !absentPlayerIds.includes(player.id)),
    [roster, absentPlayerIds],
  )

  const totalPlanMinutes = matchCount * sportConfig.periodCount * sportConfig.periodDurationMinutes

  const playerMinutes = useMemo(() => {
    const minutes = new Map<string, number>()
    for (const player of roster) minutes.set(player.id, 0)
    for (const slot of slots) {
      const duration = slot.endMinute - slot.startMinute
      for (const playerId of Object.values(slot.assignments)) {
        if (playerId) minutes.set(playerId, (minutes.get(playerId) ?? 0) + duration)
      }
    }
    return minutes
  }, [slots, roster])

  const handleSlotSave = (slotId: string, updates: Pick<TimeSlot, 'assignments' | 'bench' | 'locked'>) => {
    updateMatchSlot(planId, slotId, updates)
    setEditingSlotId(null)
  }

  const handleSlotRelease = (slotId: string) => {
    updateMatchSlot(planId, slotId, { locked: false })
  }

  const slotsByMatchByPeriod = useMemo(
    () => buildSlotsByMatchByPeriod(slots, matchCount, sportConfig.periodCount),
    [slots, matchCount, sportConfig.periodCount],
  )

  if (slots.length === 0) {
    return (
      <Card className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">No generated plan yet</p>
          <p className="text-sm text-slate-500">Generate the plan in the planner step first.</p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {slotsByMatchByPeriod.map((periods, matchIndex) => (
        <div key={matchIndex}>
          {matchCount > 1 && (
            <h2 className="mt-2 mb-1 text-sm font-bold text-slate-700">Match {matchIndex + 1}</h2>
          )}
          {periods.map((periodSlots, periodIndex) => (
            <div key={periodIndex} className="mb-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {sportConfig.periodCount > 1 ? `Half ${periodIndex + 1}` : 'Full match'}
              </h3>
              <div className="space-y-2">
                {periodSlots.map((slot, slotIndex) => {
                  const nextSlot = periodSlots[slotIndex + 1]
                  const diff = nextSlot ? computeSubDiff(slot, nextSlot) : null
                  const goingOffNextIds = diff ? new Set(diff.goingOff) : undefined
                  const comingOnNextPositions = nextSlot
                    ? buildComingOnPositions(nextSlot, diff?.comingOn ?? [], sportConfig)
                    : undefined

                  return (
                    <SlotCard
                      key={slot.id}
                      slot={slot}
                      sportConfig={sportConfig}
                      players={activePlayers}
                      playerMinutes={playerMinutes}
                      totalMinutes={totalPlanMinutes}
                      isEditing={editingSlotId === slot.id}
                      comingOnNextPositions={comingOnNextPositions}
                      goingOffNextIds={goingOffNextIds}
                      onEdit={() => setEditingSlotId(slot.id)}
                      onSave={(updates) => handleSlotSave(slot.id, updates)}
                      onRelease={() => handleSlotRelease(slot.id)}
                      onCancel={() => setEditingSlotId(null)}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ))}

      <Button
        variant="secondary"
        onClick={handleShare}
        fullWidth
      >
        {shareCopied ? 'Link copied!' : 'Copy share link'}
      </Button>
    </div>
  )
}

export function PlanPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { items, updateMatch } = useSavedPlansStore()
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])
  const [headerShareCopied, setHeaderShareCopied] = useState(false)

  const handleHeaderShare = (currentPlan: MatchPlan) => {
    const url = buildShareUrl(currentPlan)
    navigator.clipboard.writeText(url)
      .then(() => {
        setHeaderShareCopied(true)
        setTimeout(() => setHeaderShareCopied(false), 2000)
      })
      .catch(() => alert('Copy failed — try again'))
  }

  const item = items.find((entry) => entry.kind === 'match' && entry.plan.id === id)

  if (!item || item.kind !== 'match' || !id) {
    return (
      <AppShell flowItems={buildTopFlowItems()} width="default">
        <div className="mx-auto max-w-lg pt-12 text-center text-slate-500">
          <p className="mb-4">Plan not found.</p>
          <Button onClick={() => navigate('/')}>Go home</Button>
        </div>
      </AppShell>
    )
  }

  const plan = item.plan
  const step = getPlanStep(searchParams.get('step'))
  const buildPlanPath = (targetStep: PlanStep) => `/plan/${id}?step=${targetStep}`
  const activePlayers = useMemo(
    () => plan.roster.filter((player) => !plan.absentPlayerIds.includes(player.id)),
    [plan.roster, plan.absentPlayerIds],
  )
  const generationSignature = useMemo(
    () => buildGenerationSignature(
      plan.sportConfig,
      plan.roster,
      plan.benchStintMinutes,
      plan.matchCount,
      plan.absentPlayerIds,
      plan.slots,
    ),
    [plan.sportConfig, plan.roster, plan.benchStintMinutes, plan.matchCount, plan.absentPlayerIds, plan.slots],
  )
  const lastGeneratedSignatureRef = useRef(plan.slots.length > 0 ? generationSignature : null)

  useEffect(() => {
    if (lastGeneratedSignatureRef.current === generationSignature) return

    if (activePlayers.length === 0) {
      setWarnings([])
      if (plan.slots.length > 0) updateMatch(id, { slots: [] })
      lastGeneratedSignatureRef.current = generationSignature
      return
    }

    const result = generatePlan({
      sportConfig: plan.sportConfig,
      players: activePlayers,
      benchStintMinutes: plan.benchStintMinutes,
      matchCount: plan.matchCount,
      existingSlots: plan.slots,
    })

    setWarnings(result.warnings.map((warning) => warning.message))
    updateMatch(id, { slots: result.slots })
    lastGeneratedSignatureRef.current = generationSignature
  }, [
    activePlayers,
    generationSignature,
    id,
    plan.benchStintMinutes,
    plan.matchCount,
    plan.slots,
    plan.sportConfig,
    updateMatch,
  ])

  const handleNameSave = () => {
    const name = nameInput.trim()
    if (name) updateMatch(id, { name })
    setEditingName(false)
  }

  return (
    <AppShell flowItems={buildTopFlowItems(id, step)} width="wide">
      <PageHeader
        title={
          editingName ? (
            <input
              autoFocus
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
              onBlur={handleNameSave}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleNameSave()
                if (event.key === 'Escape') setEditingName(false)
              }}
              className="w-full border-b border-blue-400 bg-transparent font-semibold text-slate-800 focus:outline-none"
            />
          ) : (
            <button
              className="text-left font-semibold text-slate-800 transition-colors hover:text-blue-600"
              onClick={() => {
                setNameInput(plan.name)
                setEditingName(true)
              }}
              title="Click to rename"
            >
              {plan.name}
            </button>
          )
        }
        action={
          <button
            onClick={() => handleHeaderShare(plan)}
            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 active:bg-slate-200"
            title="Copy share link"
          >
            {headerShareCopied ? (
              <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            )}
            {headerShareCopied ? 'Copied!' : 'Share'}
          </button>
        }
      />

      <p className="mb-4 text-xs text-slate-500">
        {plan.sportConfig.name} · {plan.sportConfig.periodCount}×{plan.sportConfig.periodDurationMinutes} min
      </p>

      {step === 'roster' && (
        <RosterStep planId={id} plan={plan} />
      )}
      {step === 'planner' && (
        <PlannerStep
          planId={id}
          plan={plan}
          warnings={warnings}
        />
      )}
      {step === 'generated' && (
        <GeneratedStep planId={id} plan={plan} />
      )}
    </AppShell>
  )
}
