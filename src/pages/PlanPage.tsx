import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { normalizePlayerLevel } from '../types'
import { buildShareUrl } from '../utils/shareUrl'
import { generatePlan } from '../scheduler'
import { useSavedPlansStore } from '../store'
import type { MatchPlan } from '../types'
import { AppShell } from '../components/common/AppShell'
import { Button } from '../components/common/Button'
import { PageHeader } from '../components/common/PageHeader'
import { buildTopFlowItems } from '../components/common/TopFlowNav'
import { Timeline } from '../components/plan-view/Timeline'
import { PrintLayout } from '../components/plan-view/PrintLayout'
import { SegmentEditor } from '../components/plan-view/SegmentEditor'
import { SetupModal } from '../components/plan-modals/SetupModal'
import { PlayersModal } from '../components/plan-modals/PlayersModal'

function buildGenerationSignature(plan: MatchPlan) {
  return JSON.stringify({
    benchStintMinutes: plan.benchStintMinutes,
    matchCount: plan.matchCount,
    absentPlayerIds: [...plan.absentPlayerIds].sort(),
    roster: plan.roster.map((player) => ({
      id: player.id,
      level: normalizePlayerLevel(player.level),
      excludedPositionTypeIds: [...player.excludedPositionTypeIds].sort(),
    })),
    pins: plan.pins,
    periods: plan.sportConfig.periodCount,
    periodDuration: plan.sportConfig.periodDurationMinutes,
    totalOnField: plan.sportConfig.totalOnField,
    lineup: plan.sportConfig.lineupSlots.map((s) => `${s.positionTypeId}:${s.label}`),
    changeKeeperMidPeriod: plan.changeKeeperMidPeriod,
  })
}

export function PlanPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { items, updateMatch, setSegmentPins, clearAllPins } = useSavedPlansStore()
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])
  const [shareCopied, setShareCopied] = useState(false)
  const [setupOpen, setSetupOpen] = useState(false)
  const [playersOpen, setPlayersOpen] = useState(false)
  const [editSeg, setEditSeg] = useState<{ segmentIndex: number; playerId: string } | null>(null)

  const item = items.find((entry) => entry.kind === 'match' && entry.plan.id === id)

  const activePlayers = useMemo(() => {
    if (!item || item.kind !== 'match') return []
    return item.plan.roster.filter((p) => !item.plan.absentPlayerIds.includes(p.id))
  }, [item])

  const generationSignature = useMemo(() => {
    if (!item || item.kind !== 'match') return ''
    return buildGenerationSignature(item.plan)
  }, [item])

  const lastGeneratedSignatureRef = useRef<string | null>(
    item && item.kind === 'match' && item.plan.slots.length > 0 ? generationSignature : null,
  )

  useEffect(() => {
    if (!item || item.kind !== 'match' || !id) return
    if (lastGeneratedSignatureRef.current === generationSignature) return

    if (activePlayers.length === 0) {
      setWarnings([])
      if (item.plan.slots.length > 0) updateMatch(id, { slots: [] })
      lastGeneratedSignatureRef.current = generationSignature
      return
    }

    const result = generatePlan({
      sportConfig: item.plan.sportConfig,
      players: activePlayers,
      benchStintMinutes: item.plan.benchStintMinutes,
      matchCount: item.plan.matchCount,
      pins: item.plan.pins,
      changeKeeperMidPeriod: item.plan.changeKeeperMidPeriod,
    })
    setWarnings(result.warnings.map((w) => w.message))
    updateMatch(id, { slots: result.slots })
    lastGeneratedSignatureRef.current = generationSignature
  }, [item, id, activePlayers, generationSignature, updateMatch])

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
  const playerById = new Map(plan.roster.map((p) => [p.id, p]))
  const pinCount = Object.keys(plan.pins).length

  const handleNameSave = () => {
    const name = nameInput.trim()
    if (name) updateMatch(id, { name })
    setEditingName(false)
  }

  const handleShare = () => {
    const url = buildShareUrl(plan)
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setShareCopied(true)
        setTimeout(() => setShareCopied(false), 2000)
      })
      .catch(() => alert('Copy failed — try again'))
  }

  return (
    <AppShell flowItems={buildTopFlowItems(id, 'plan')} width="full">
      <div className="no-print">
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
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setPlayersOpen(true)}>
                Players ({plan.roster.length})
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setSetupOpen(true)}>
                Setup
              </Button>
              {pinCount > 0 && (
                <Button size="sm" variant="secondary" onClick={() => clearAllPins(id)}>
                  Clear {pinCount} pin{pinCount === 1 ? '' : 's'}
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={handleShare}>
                {shareCopied ? 'Copied!' : 'Share'}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => window.print()}>
                Print
              </Button>
            </div>
          }
        />

        <p className="mb-4 text-xs text-slate-500">
          {plan.sportConfig.name} · {plan.sportConfig.periodCount}×{plan.sportConfig.periodDurationMinutes} min ·{' '}
          {plan.benchStintMinutes} min stints
          {pinCount > 0 && ` · ${pinCount} segment pin${pinCount === 1 ? '' : 's'}`}
        </p>

        {warnings.length > 0 && (
          <div className="mb-4 space-y-1">
            {warnings.map((warning, index) => (
              <div
                key={index}
                className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700"
              >
                {warning}
              </div>
            ))}
          </div>
        )}

        <div className="space-y-8">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="px-3 py-2 border-b border-slate-100 bg-slate-50">
              <p className="text-xs font-semibold text-slate-500">Player timeline · click any cell to edit</p>
            </div>
            <div className="p-2 lg:p-4">
              <Timeline
                slots={plan.slots}
                sportConfig={plan.sportConfig}
                players={plan.roster}
                onCellClick={(segmentIndex, playerId) => setEditSeg({ segmentIndex, playerId })}
              />
            </div>
          </div>

          {Array.from({ length: plan.matchCount }, (_, mi) => (
            <section key={mi} className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4 lg:p-5">
              {plan.matchCount > 1 && <h2 className="font-bold text-slate-800 mb-4">Match {mi + 1}</h2>}
              <div className="space-y-5">
                {Array.from({ length: plan.sportConfig.periodCount }, (_, pi) => {
                  const periodSlots = plan.slots.filter(
                    (s) => s.matchIndex === mi && s.periodIndex === pi,
                  )
                  const periodBg = pi % 2 === 0 ? 'bg-white' : 'bg-blue-50/60'
                  return (
                    <div
                      key={pi}
                      className={[
                        'rounded-2xl border p-4',
                        periodBg,
                        pi % 2 === 0 ? 'border-slate-200' : 'border-blue-100',
                      ].join(' ')}
                    >
                      <h3 className="font-semibold text-slate-700 text-sm mb-3">
                        {plan.sportConfig.periodCount > 1 ? `Period ${pi + 1}` : 'Full match'}
                      </h3>
                      {periodSlots[0] && (
                        <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-700 mb-2">
                            Suggested starting lineup
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {plan.sportConfig.lineupSlots.map((ls) => {
                              const pid = periodSlots[0]!.positions[ls.slotId]
                              const name = pid ? playerById.get(pid)?.name : null
                              return (
                                <span
                                  key={ls.slotId}
                                  className="text-xs rounded-lg bg-white px-2 py-1 border border-blue-100"
                                >
                                  <span className="text-blue-700 font-semibold">{ls.label} </span>
                                  {name ?? <span className="text-red-400">—</span>}
                                </span>
                              )
                            })}
                          </div>
                        </div>
                      )}
                      <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
                        {periodSlots.map((slot, idx) => {
                          const next = periodSlots[idx + 1]
                          const curIds = new Set([...(slot.gkId ? [slot.gkId] : []), ...slot.fieldIds])
                          const nextIds = next
                            ? new Set([...(next.gkId ? [next.gkId] : []), ...next.fieldIds])
                            : null
                          const goingOff = nextIds
                            ? [...curIds].filter((pid) => !nextIds.has(pid))
                            : []
                          const gkPlayer = slot.gkId ? playerById.get(slot.gkId) : null
                          return (
                            <div
                              key={slot.id}
                              className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm"
                            >
                              <p className="text-xs font-semibold text-slate-500 mb-2">
                                {Math.floor(slot.startMinute)}'–{Math.ceil(slot.endMinute)}'
                              </p>
                              <div className="space-y-1.5">
                                {slot.midSwap && (
                                  <p className="text-[10px] font-semibold uppercase text-amber-700">
                                    Mid-segment keeper swap @ {Math.floor(slot.midSwap.atMinute)}'
                                  </p>
                                )}
                                <div>
                                  <span className="text-[10px] font-semibold uppercase text-yellow-700 mr-2">GK</span>
                                  <span className="text-xs font-medium text-slate-700">
                                    {slot.midSwap ? (
                                      <>
                                        {playerById.get(slot.midSwap.preGkId ?? '')?.name ?? '—'}{' '}
                                        <span className="text-slate-400">→</span>{' '}
                                        {gkPlayer?.name ?? '—'}
                                      </>
                                    ) : (
                                      gkPlayer?.name ?? <span className="text-red-400">—</span>
                                    )}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[10px] font-semibold uppercase text-blue-700 mr-2">Field</span>
                                  {slot.fieldIds.length === 0 ? (
                                    <span className="text-xs text-slate-400">—</span>
                                  ) : (
                                    <span className="inline-flex flex-wrap gap-1">
                                      {slot.fieldIds.map((pid) => {
                                        const name = playerById.get(pid)?.name ?? pid
                                        const off = goingOff.includes(pid)
                                        return (
                                          <span
                                            key={pid}
                                            className={[
                                              'text-xs rounded-md px-1.5 py-0.5',
                                              off
                                                ? 'bg-amber-200 text-amber-900 font-semibold ring-1 ring-amber-400'
                                                : 'text-slate-700',
                                            ].join(' ')}
                                          >
                                            {name}
                                            {off && ' ↓'}
                                          </span>
                                        )
                                      })}
                                    </span>
                                  )}
                                </div>
                                {slot.benchIds.length > 0 && (
                                  <div>
                                    <span className="text-[10px] font-semibold uppercase text-slate-500 mr-2">Bench</span>
                                    <span className="text-xs text-slate-500">
                                      {slot.benchIds.map((pid) => playerById.get(pid)?.name ?? pid).join(', ')}
                                    </span>
                                  </div>
                                )}
                                {slot.absentIds.length > 0 && (
                                  <div>
                                    <span className="text-[10px] font-semibold uppercase text-rose-700 mr-2">Absent</span>
                                    <span className="text-xs text-rose-700">
                                      {slot.absentIds
                                        .map((pid) => {
                                          const name = playerById.get(pid)?.name ?? pid
                                          return slot.absentCreditedIds.includes(pid) ? `${name}*` : name
                                        })
                                        .join(', ')}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      <div className="print-only hidden">
        <PrintLayout plan={plan} />
      </div>

      {setupOpen && <SetupModal plan={plan} onClose={() => setSetupOpen(false)} />}
      {playersOpen && <PlayersModal plan={plan} onClose={() => setPlayersOpen(false)} />}

      {editSeg && plan.slots[editSeg.segmentIndex] && (
        <SegmentEditor
          slots={plan.slots}
          segmentIndex={editSeg.segmentIndex}
          selectedPlayerId={editSeg.playerId}
          players={plan.roster}
          pins={plan.pins}
          totalOnField={plan.sportConfig.totalOnField}
          onClose={() => setEditSeg(null)}
          onSetPins={(updates) => setSegmentPins(id, updates)}
        />
      )}
    </AppShell>
  )
}
