import { useNavigate } from 'react-router-dom'
import { useMatchStore } from '../store'
import { PageHeader } from '../components/common/PageHeader'
import { Button } from '../components/common/Button'
import { Timeline } from '../components/plan-view/Timeline'
import { PrintLayout } from '../components/plan-view/PrintLayout'

export function PlanViewPage() {
  const navigate = useNavigate()
  const { plan } = useMatchStore()

  if (!plan) {
    return (
      <div className="px-4 pt-12 text-center text-slate-500 max-w-lg mx-auto">
        <p className="mb-4">No plan loaded.</p>
        <Button onClick={() => navigate('/')}>Go home</Button>
      </div>
    )
  }

  return (
    <div className="px-4 pb-12 max-w-lg mx-auto">
      {/* Screen view */}
      <div className="no-print">
        <PageHeader
          title={plan.name}
          backTo="/planner"
          action={
            <Button size="sm" variant="secondary" onClick={() => window.print()}>
              Print
            </Button>
          }
        />

        <p className="text-xs text-slate-500 mb-4">
          {plan.sportConfig.name} · {plan.sportConfig.periodCount}×{plan.sportConfig.periodDurationMinutes} min ·{' '}
          {plan.subsPerPeriod} sub{plan.subsPerPeriod !== 1 ? 's' : ''} per half ·{' '}
          Keeper: {plan.keeperMode}
        </p>

        {/* Timeline */}
        <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="px-3 py-2 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-500">Player timeline</p>
          </div>
          <div className="p-3">
            <Timeline slots={plan.slots} sportConfig={plan.sportConfig} players={plan.roster} />
          </div>
        </div>

        {/* Period cards */}
        {Array.from({ length: plan.sportConfig.periodCount }, (_, pi) => {
          const periodSlots = plan.slots.filter((s) => s.periodIndex === pi)
          const playerById = new Map(plan.roster.map((p) => [p.id, p]))

          return (
            <div key={pi} className="mb-6">
              <h2 className="font-semibold text-slate-700 mb-2">
                {plan.sportConfig.periodCount > 1 ? `Half ${pi + 1}` : 'Match'}
              </h2>
              <div className="space-y-2">
                {periodSlots.map((slot) => (
                  <div key={slot.id} className="bg-white border border-slate-200 rounded-2xl p-3">
                    <p className="text-xs font-semibold text-slate-500 mb-2">
                      {Math.floor(slot.startMinute)}' – {Math.ceil(slot.endMinute)}'
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {plan.sportConfig.lineupSlots.map((ls) => {
                        const pid = slot.assignments[ls.slotId]
                        const player = pid ? playerById.get(pid) : undefined
                        return (
                          <span key={ls.slotId} className="text-xs bg-slate-100 rounded-lg px-2 py-1 font-medium">
                            <span className="text-slate-500">{ls.label} </span>
                            {player?.name ?? <span className="text-red-400">—</span>}
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
                ))}
              </div>
            </div>
          )
        })}

        <div className="flex gap-2">
          <Button variant="secondary" fullWidth onClick={() => navigate('/planner')}>
            Edit plan
          </Button>
          <Button variant="secondary" fullWidth onClick={() => navigate('/')}>
            Home
          </Button>
        </div>
      </div>

      {/* Print-only layout */}
      <div className="print-only hidden">
        <PrintLayout plan={plan} />
      </div>
    </div>
  )
}
