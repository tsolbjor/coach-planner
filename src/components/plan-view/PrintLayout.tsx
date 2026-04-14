import type { MatchPlan } from '../../types'
import { Timeline } from './Timeline'

interface PrintLayoutProps {
  plan: MatchPlan
}

export function PrintLayout({ plan }: PrintLayoutProps) {
  return (
    <div className="p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{plan.name}</h1>
        <p className="text-slate-500 text-sm">
          {plan.sportConfig.name} · {plan.sportConfig.periodCount}×{plan.sportConfig.periodDurationMinutes} min ·{' '}
          {plan.benchStintMinutes} min stints
        </p>
      </div>

      <Timeline slots={plan.slots} sportConfig={plan.sportConfig} players={plan.roster} />

      {/* Period-by-period lineup cards */}
      {Array.from({ length: plan.sportConfig.periodCount }, (_, pi) => (
        <div key={pi}>
          <h2 className="text-lg font-semibold mb-2">Half {pi + 1}</h2>
          <div className="grid grid-cols-1 gap-2">
            {plan.slots
              .filter((s) => s.periodIndex === pi)
              .map((slot) => {
                const playerById = new Map(plan.roster.map((p) => [p.id, p]))
                return (
                  <div key={slot.id} className="border border-slate-200 rounded-xl p-3">
                    <p className="text-xs font-semibold text-slate-500 mb-1.5">
                      {Math.floor(slot.startMinute)}' – {Math.floor(slot.endMinute)}'
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {plan.sportConfig.lineupSlots.map((ls) => {
                        const pid = slot.assignments[ls.slotId]
                        const player = pid ? playerById.get(pid) : undefined
                        return (
                          <span key={ls.slotId} className="text-xs bg-slate-100 rounded-lg px-2 py-0.5">
                            <span className="font-semibold">{ls.label}</span>{' '}
                            {player?.name ?? '—'}
                          </span>
                        )
                      })}
                    </div>
                    {slot.bench.length > 0 && (
                      <p className="text-xs text-slate-500 mt-1.5">
                        Bench: {slot.bench.map((id) => playerById.get(id)?.name ?? id).join(', ')}
                      </p>
                    )}
                  </div>
                )
              })}
          </div>
        </div>
      ))}
    </div>
  )
}
