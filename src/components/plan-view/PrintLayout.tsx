import type { MatchPlan } from '../../types'
import { Timeline } from './Timeline'

interface PrintLayoutProps {
  plan: MatchPlan
}

export function PrintLayout({ plan }: PrintLayoutProps) {
  const playerById = new Map(plan.roster.map((p) => [p.id, p]))

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

      {Array.from({ length: plan.sportConfig.periodCount }, (_, pi) => {
        const periodSlots = plan.slots.filter((s) => s.periodIndex === pi)
        return (
          <div key={pi}>
            <h2 className="text-lg font-semibold mb-2">Half {pi + 1}</h2>
            <div className="grid grid-cols-1 gap-2">
              {periodSlots.map((slot, idx) => {
                const next = periodSlots[idx + 1]
                const curIds = new Set([...(slot.gkId ? [slot.gkId] : []), ...slot.fieldIds])
                const nextIds = next
                  ? new Set([...(next.gkId ? [next.gkId] : []), ...next.fieldIds])
                  : null
                const goingOff = nextIds ? [...curIds].filter((pid) => !nextIds.has(pid)) : []
                const gk = slot.gkId ? playerById.get(slot.gkId) : null
                return (
                  <div key={slot.id} className="border border-slate-200 rounded-xl p-3">
                    <p className="text-xs font-semibold text-slate-500 mb-1.5">
                      {Math.floor(slot.startMinute)}'–{Math.floor(slot.endMinute)}'
                    </p>
                    <p className="text-xs">
                      <span className="font-semibold">GK:</span> {gk?.name ?? '—'}
                    </p>
                    <p className="text-xs">
                      <span className="font-semibold">Field:</span>{' '}
                      {slot.fieldIds.length === 0 ? (
                        '—'
                      ) : (
                        slot.fieldIds.map((id, i) => {
                          const name = playerById.get(id)?.name ?? id
                          const off = goingOff.includes(id)
                          return (
                            <span key={id}>
                              {i > 0 && ', '}
                              <span className={off ? 'bg-amber-200 px-1 rounded font-semibold' : ''}>
                                {name}
                                {off && ' ↓'}
                              </span>
                            </span>
                          )
                        })
                      )}
                    </p>
                    {slot.benchIds.length > 0 && (
                      <p className="text-xs text-slate-500 mt-1">
                        <span className="font-semibold">Bench:</span>{' '}
                        {slot.benchIds.map((id) => playerById.get(id)?.name ?? id).join(', ')}
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
  )
}
