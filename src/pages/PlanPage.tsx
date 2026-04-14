import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
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

function getPlanStep(value: string | null): PlanStep {
  if (value === 'roster' || value === 'generated') return value
  return 'planner'
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
      excludedPositionTypeIds: [...player.excludedPositionTypeIds].sort(),
    })),
    lockedSlotIds: slots.filter((s) => s.locked).map((s) => s.id).sort(),
  })
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
        onClick={() => {
          const playerMinutesSummary = Array.from(playerMinutes.entries()).map(([playerId, totalMinutes]) => {
            const player = roster.find((entry) => entry.id === playerId)
            return { id: playerId, name: player?.name ?? playerId, totalMinutes }
          })
          const payload = {
              config: {
                sportConfig,
                benchStintMinutes,
                matchCount,
                absentPlayerIds,
              },
            roster,
            slots,
            playerMinutesSummary,
          }
          navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
            .then(() => alert('Copied to clipboard!'))
            .catch(() => alert('Copy failed — try again'))
        }}
        fullWidth
      >
        Export
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
