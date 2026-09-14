import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { buildShareUrl } from '../utils/shareUrl'
import { getBoundaryTransition } from '../utils/slotTransitions'
import { formatMinute } from '../utils/slotIntervals'
import { useSavedPlansStore } from '../store'
import { AppShell } from '../components/common/AppShell'
import { Button } from '../components/common/Button'
import { PageHeader } from '../components/common/PageHeader'
import { buildTopFlowItems } from '../components/common/TopFlowNav'
import { Timeline } from '../components/plan-view/Timeline'
import { PrintLayout } from '../components/plan-view/PrintLayout'
import { SegmentEditor } from '../components/plan-view/SegmentEditor'
import { SetupModal } from '../components/plan-modals/SetupModal'
import { PlayersModal } from '../components/plan-modals/PlayersModal'

export function PlanPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { items, updateMatch, setSegmentPins, clearAllPins } = useSavedPlansStore()
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [shareCopied, setShareCopied] = useState(false)
  const [setupOpen, setSetupOpen] = useState(false)
  const [playersOpen, setPlayersOpen] = useState(false)
  const [editSeg, setEditSeg] = useState<{ segmentIndex: number; playerId: string; mode: 'plan' | 'in-game' } | null>(null)
  const [viewMode, setViewMode] = useState<'plan' | 'in-game'>('plan')
  const [focusMatchIndex, setFocusMatchIndex] = useState(0)
  const [focusPeriodIndex, setFocusPeriodIndex] = useState(0)
  const [focusSegmentIndex, setFocusSegmentIndex] = useState<number | null>(null)

  const item = items.find((entry) => entry.kind === 'match' && entry.plan.id === id)

  const slotEntries = useMemo(() => {
    if (!item || item.kind !== 'match') return []
    return item.plan.slots.map((slot, index) => ({ slot, index }))
  }, [item])

  useEffect(() => {
    if (!item || item.kind !== 'match') return
    const maxMatchIndex = Math.max(0, item.plan.matchCount - 1)
    if (focusMatchIndex > maxMatchIndex) setFocusMatchIndex(maxMatchIndex)
  }, [item, focusMatchIndex])

  useEffect(() => {
    if (!item || item.kind !== 'match') return
    const maxPeriodIndex = Math.max(0, item.plan.sportConfig.periodCount - 1)
    if (focusPeriodIndex > maxPeriodIndex) setFocusPeriodIndex(maxPeriodIndex)
  }, [item, focusPeriodIndex])

  const focusSlotEntries = useMemo(
    () =>
      slotEntries.filter(
        ({ slot }) => slot.matchIndex === focusMatchIndex && slot.periodIndex === focusPeriodIndex,
      ),
    [slotEntries, focusMatchIndex, focusPeriodIndex],
  )

  useEffect(() => {
    if (focusSlotEntries.length === 0) {
      if (focusSegmentIndex !== null) setFocusSegmentIndex(null)
      return
    }
    const inScope =
      focusSegmentIndex !== null &&
      focusSlotEntries.some((entry) => entry.index === focusSegmentIndex)
    if (!inScope) setFocusSegmentIndex(focusSlotEntries[0]!.index)
  }, [focusSlotEntries, focusSegmentIndex])

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
  const warnings = plan.warnings ?? []
  const lockedCount = plan.lockedSlots?.length ?? 0
  const playerById = new Map(plan.roster.map((p) => [p.id, p]))
  const pinCount = Object.keys(plan.pins).length
  const editablePinCount = Object.keys(plan.pins).filter((index) => Number(index) >= lockedCount).length
  const activeEntryIndex =
    focusSegmentIndex !== null
      ? focusSlotEntries.findIndex((entry) => entry.index === focusSegmentIndex)
      : -1
  const activeEntry = activeEntryIndex >= 0 ? focusSlotEntries[activeEntryIndex] : null
  const nextEntry =
    activeEntryIndex >= 0 && activeEntryIndex + 1 < focusSlotEntries.length
      ? focusSlotEntries[activeEntryIndex + 1]
      : null
  const activeOnIds = activeEntry
    ? [activeEntry.slot.gkId, ...activeEntry.slot.fieldIds].filter((pid): pid is string => !!pid)
    : []
  const nextBoundary = activeEntry ? getBoundaryTransition(activeEntry.slot, nextEntry?.slot) : { off: [], on: [] }
  const offNextIds = nextBoundary.off
  const onNextIds = nextBoundary.on
  const activeBenchIds = activeEntry?.slot.benchIds ?? []
  const activeAbsentIds = activeEntry?.slot.absentIds ?? []

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

  const openActiveSegmentEditor = (playerId: string) => {
    if (!activeEntry || activeEntry.index < lockedCount) return
    setEditSeg({ segmentIndex: activeEntry.index, playerId, mode: 'in-game' })
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
              {editablePinCount > 0 && (
                <Button size="sm" variant="secondary" onClick={() => clearAllPins(id)}>
                  Clear {editablePinCount} pin{editablePinCount === 1 ? '' : 's'}
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
          substitutions every {plan.benchStintMinutes} min
          {pinCount > 0 && ` · ${pinCount} segment pin${pinCount === 1 ? '' : 's'}`}
        </p>

        {warnings.length > 0 && (
          <div className="mb-4 space-y-1">
            {warnings.map((warning, index) => (
              <div
                key={index}
                className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700"
              >
                {warning.message}
              </div>
            ))}
          </div>
        )}

        <div className="mb-4">
          <div className="inline-flex w-full rounded-2xl border border-slate-200 bg-slate-100 p-1 sm:w-auto">
            <button
              type="button"
              onClick={() => setViewMode('plan')}
              className={[
                'flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-colors sm:flex-none',
                viewMode === 'plan' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600',
              ].join(' ')}
            >
              Full plan
            </button>
            <button
              type="button"
              onClick={() => setViewMode('in-game')}
              className={[
                'flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-colors sm:flex-none',
                viewMode === 'in-game' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600',
              ].join(' ')}
            >
              In-game
            </button>
          </div>
        </div>

        {viewMode === 'in-game' ? (
          <div className="space-y-4">
            <section className="rounded-2xl border border-blue-200 bg-white p-3 sm:p-4">
              <div className="mb-3 flex flex-wrap gap-2">
                {plan.matchCount > 1 && (
                  <label className="flex min-w-[9rem] flex-1 flex-col gap-1 text-xs font-semibold text-slate-500">
                    Match
                    <select
                      value={focusMatchIndex}
                      onChange={(event) => {
                        setFocusMatchIndex(Number(event.target.value))
                        setFocusSegmentIndex(null)
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-800"
                    >
                      {Array.from({ length: plan.matchCount }, (_, mi) => (
                        <option key={mi} value={mi}>
                          Match {mi + 1}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {plan.sportConfig.periodCount > 1 && (
                  <label className="flex min-w-[9rem] flex-1 flex-col gap-1 text-xs font-semibold text-slate-500">
                    Period
                    <select
                      value={focusPeriodIndex}
                      onChange={(event) => {
                        setFocusPeriodIndex(Number(event.target.value))
                        setFocusSegmentIndex(null)
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-800"
                    >
                      {Array.from({ length: plan.sportConfig.periodCount }, (_, pi) => (
                        <option key={pi} value={pi}>
                          Period {pi + 1}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              {focusSlotEntries.length === 0 ? (
                <p className="text-sm text-slate-500">No segments in this period.</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        const prev = Math.max(0, activeEntryIndex - 1)
                        setFocusSegmentIndex(focusSlotEntries[prev]!.index)
                      }}
                      disabled={activeEntryIndex <= 0}
                    >
                      Prev
                    </Button>
                    <select
                      value={activeEntry?.index ?? ''}
                      onChange={(event) => setFocusSegmentIndex(Number(event.target.value))}
                      className="min-touch min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-800"
                    >
                      {focusSlotEntries.map((entry) => (
                        <option key={entry.slot.id} value={entry.index}>
                          {formatMinute(entry.slot.startMinute)}–{formatMinute(entry.slot.endMinute)}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        const next = Math.min(focusSlotEntries.length - 1, activeEntryIndex + 1)
                        setFocusSegmentIndex(focusSlotEntries[next]!.index)
                      }}
                      disabled={activeEntryIndex < 0 || activeEntryIndex >= focusSlotEntries.length - 1}
                    >
                      Next
                    </Button>
                  </div>

                  {activeEntry && (
                    <>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          Current segment
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-800">
                          Match {activeEntry.slot.matchIndex + 1} · Period {activeEntry.slot.periodIndex + 1} ·{' '}
                          {formatMinute(activeEntry.slot.startMinute)}–{formatMinute(activeEntry.slot.endMinute)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {activeEntry.index < lockedCount
                            ? 'Completed play is locked and cannot be edited.'
                            : 'Adjust this interval; earlier play is preserved and the remaining plan rebalances.'}
                        </p>
                      </div>

                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                          Next sub
                        </p>
                        {nextEntry ? (
                          <div className="mt-1 space-y-1">
                            <p className="text-sm font-semibold text-amber-900">
                              At {formatMinute(nextEntry.slot.startMinute)}
                            </p>
                            <p className="text-xs text-amber-800">
                              Off:{' '}
                              {offNextIds.length > 0
                                ? offNextIds.map((pid) => playerById.get(pid)?.name ?? pid).join(', ')
                                : 'No changes'}
                            </p>
                            <p className="text-xs text-amber-800">
                              On:{' '}
                              {onNextIds.length > 0
                                ? onNextIds.map((pid) => playerById.get(pid)?.name ?? pid).join(', ')
                                : 'No changes'}
                            </p>
                            {activeEntry.slot.gkId !== nextEntry.slot.gkId && (
                              <p className="text-xs text-amber-800">
                                GK: {playerById.get(activeEntry.slot.gkId ?? '')?.name ?? '—'} →{' '}
                                {playerById.get(nextEntry.slot.gkId ?? '')?.name ?? '—'}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="mt-1 text-xs text-amber-800">Final segment in this period.</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          Quick adjust
                        </p>
                        <QuickGroup
                          label="On field"
                          ids={activeOnIds}
                          playerById={playerById}
                          onPick={openActiveSegmentEditor}
                          tone="field"
                        />
                        <QuickGroup
                          label="Bench"
                          ids={activeBenchIds}
                          playerById={playerById}
                          onPick={openActiveSegmentEditor}
                          tone="bench"
                        />
                        <QuickGroup
                          label="Absent"
                          ids={activeAbsentIds}
                          playerById={playerById}
                          onPick={openActiveSegmentEditor}
                          tone="absent"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="px-3 py-2 border-b border-slate-100 bg-slate-50">
                <p className="text-xs font-semibold text-slate-500">
                  Player timeline · {lockedCount ? 'completed play is locked; click a remaining interval to edit' : 'click any cell to edit'}
                </p>
              </div>
              <div className="p-2 lg:p-4">
                <Timeline
                  slots={plan.slots}
                  sportConfig={plan.sportConfig}
                  players={plan.roster}
                  onCellClick={(segmentIndex, playerId) => {
                    if (segmentIndex >= lockedCount) setEditSeg({ segmentIndex, playerId, mode: 'plan' })
                  }}
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
                            const nextBoundary = getBoundaryTransition(slot, next)
                            const goingOff = nextBoundary.off
                            const gkPlayer = slot.gkId ? playerById.get(slot.gkId) : null
                            return (
                              <div
                                key={slot.id}
                                className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm"
                              >
                                <p className="text-xs font-semibold text-slate-500 mb-2">
                                  {formatMinute(slot.startMinute)}–{formatMinute(slot.endMinute)}
                                </p>
                                <div className="space-y-1.5">
                                  <div>
                                    <span className="text-[10px] font-semibold uppercase text-yellow-700 mr-2">GK</span>
                                    <span className="text-xs font-medium text-slate-700">
                                      {gkPlayer?.name ?? <span className="text-red-400">—</span>}
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
        )}
      </div>

      <div className="print-only hidden">
        <PrintLayout plan={plan} />
      </div>

      {setupOpen && <SetupModal plan={plan} onClose={() => setSetupOpen(false)} />}
      {playersOpen && <PlayersModal plan={plan} onClose={() => setPlayersOpen(false)} />}

      {editSeg && editSeg.segmentIndex >= lockedCount && plan.slots[editSeg.segmentIndex] && (
        <SegmentEditor
          slots={plan.slots}
          segmentIndex={editSeg.segmentIndex}
          selectedPlayerId={editSeg.playerId}
          players={plan.roster}
          pins={plan.pins}
          totalOnField={plan.sportConfig.totalOnField}
          interactionMode={editSeg.mode}
          onClose={() => setEditSeg(null)}
          onSetPins={(updates) => setSegmentPins(id, updates, editSeg.mode === 'in-game' ? editSeg.segmentIndex : undefined)}
        />
      )}
    </AppShell>
  )
}

function QuickGroup({
  label,
  ids,
  playerById,
  onPick,
  tone,
}: {
  label: string
  ids: string[]
  playerById: Map<string, { name: string }>
  onPick: (playerId: string) => void
  tone: 'field' | 'bench' | 'absent'
}) {
  const toneClass = {
    field: 'border-blue-200 bg-blue-50 text-blue-900',
    bench: 'border-slate-300 bg-slate-100 text-slate-700',
    absent: 'border-rose-200 bg-rose-50 text-rose-800',
  }[tone]
  const statusText = { field: 'Field', bench: 'Bench', absent: 'Absent' }[tone]

  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      {ids.length === 0 ? (
        <p className="text-xs text-slate-400">—</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {ids.map((pid) => (
            <button
              key={pid}
              type="button"
              onClick={() => onPick(pid)}
              aria-label={`${label}: ${playerById.get(pid)?.name ?? pid}`}
              className={['rounded-lg border px-2.5 py-1.5 text-xs font-medium', toneClass].join(' ')}
            >
              {statusText} · {playerById.get(pid)?.name ?? pid}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
