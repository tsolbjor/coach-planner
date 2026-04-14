import { useParams, useNavigate } from 'react-router-dom'
import { useSavedPlansStore } from '../store'
import { AppShell } from '../components/common/AppShell'
import { PageHeader } from '../components/common/PageHeader'
import { Button } from '../components/common/Button'
import { buildTopFlowItems } from '../components/common/TopFlowNav'
import { Timeline } from '../components/plan-view/Timeline'
import { PrintLayout } from '../components/plan-view/PrintLayout'
import { computeSubDiff } from '../components/planner/SubMarker'

export function PlanViewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { getSaved } = useSavedPlansStore()

  const saved = id ? getSaved(id) : undefined
  const plan = saved?.kind === 'match' ? saved.plan : undefined

  if (!plan) {
    return (
      <AppShell flowItems={buildTopFlowItems()} width="default">
        <div className="mx-auto max-w-lg pt-12 text-center text-slate-500">
          <p className="mb-4">Plan not found.</p>
          <Button onClick={() => navigate('/')}>Go home</Button>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell flowItems={buildTopFlowItems(plan.id, 'full')} width="full">
      {/* Screen view */}
      <div className="no-print">
        <PageHeader
          title={plan.name}
          action={
            <Button size="sm" variant="secondary" onClick={() => window.print()}>
              Print
            </Button>
          }
        />

        <p className="text-xs text-slate-500 mb-4">
          {plan.sportConfig.name} · {plan.sportConfig.periodCount}×{plan.sportConfig.periodDurationMinutes} min ·{' '}
          {plan.benchStintMinutes} min stints
        </p>

        <div className="space-y-8">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="px-3 py-2 border-b border-slate-100 bg-slate-50">
              <p className="text-xs font-semibold text-slate-500">Player timeline</p>
            </div>
            <div className="p-2 lg:p-4">
              <Timeline slots={plan.slots} sportConfig={plan.sportConfig} players={plan.roster} />
            </div>
          </div>

          {Array.from({ length: plan.matchCount }, (_, mi) => {
            const playerById = new Map(plan.roster.map((p) => [p.id, p]))
            return (
              <section
                key={mi}
                className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4 lg:p-5"
              >
                {plan.matchCount > 1 && (
                  <h2 className="font-bold text-slate-800 mb-4">Match {mi + 1}</h2>
                )}
                <div className="space-y-5">
                  {Array.from({ length: plan.sportConfig.periodCount }, (_, pi) => {
                    const periodSlots = plan.slots.filter(
                      (s) => (s.matchIndex ?? 0) === mi && s.periodIndex === pi,
                    )
                    const periodBg = pi % 2 === 0 ? 'bg-white' : 'bg-blue-50/60'
                    return (
                      <div
                        key={pi}
                        className={['rounded-2xl border p-4', periodBg, pi % 2 === 0 ? 'border-slate-200' : 'border-blue-100'].join(' ')}
                      >
                        <h3 className="font-semibold text-slate-700 text-sm mb-3">
                          {plan.sportConfig.periodCount > 1 ? `Period ${pi + 1}` : 'Full match'}
                        </h3>
                        <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
                          {periodSlots.map((slot, idx) => {
                            const nextSlot = periodSlots[idx + 1]
                            const goingOffNextIds = nextSlot
                              ? new Set(computeSubDiff(slot, nextSlot).goingOff)
                              : undefined
                            return (
                              <div key={slot.id} className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
                                <p className="text-xs font-semibold text-slate-500 mb-2">
                                  {Math.floor(slot.startMinute)}' – {Math.ceil(slot.endMinute)}'
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {plan.sportConfig.lineupSlots.map((ls) => {
                                    const pid = slot.assignments[ls.slotId]
                                    const player = pid ? playerById.get(pid) : undefined
                                    const goingOff = player && goingOffNextIds?.has(player.id)
                                    return (
                                      <span
                                        key={ls.slotId}
                                        className={[
                                          'text-xs rounded-lg px-2 py-1 font-medium bg-slate-100',
                                          goingOff ? 'ring-1 ring-amber-400' : '',
                                        ].join(' ')}
                                      >
                                        <span className="text-slate-500">{ls.label} </span>
                                        {player?.name ?? <span className="text-red-400">—</span>}
                                        {goingOff && <span className="ml-0.5">↓</span>}
                                      </span>
                                    )
                                  })}
                                </div>
                                {slot.bench.length > 0 && (
                                  <p className="text-xs text-slate-500 mt-2">
                                    <span className="font-medium">Bench: </span>
                                    {slot.bench.map((id) => playerById.get(id)?.name ?? id).join(', ')}
                                  </p>
                                )}
                              </div>
                            )
                          })}
                        </div>
                    </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      </div>

      {/* Print-only layout */}
      <div className="print-only hidden">
        <PrintLayout plan={plan} />
      </div>
    </AppShell>
  )
}
