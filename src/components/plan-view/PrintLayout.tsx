import type { MatchPlan } from '../../types'
import { Timeline } from './Timeline'
import { getBoundaryTransition } from '../../utils/slotTransitions'
import { formatMinute, groupSlotsByPeriod } from '../../utils/slotIntervals'

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
          {plan.benchStintMinutes} min substitution interval
        </p>
      </div>

      <Timeline slots={plan.slots} sportConfig={plan.sportConfig} players={plan.roster} />

      {(plan.warnings?.length ?? 0) > 0 && (
        <div className="text-sm text-amber-800">
          <h2 className="font-semibold">Plan warnings</h2>
          {plan.warnings!.map((warning, index) => <p key={index}>{warning.message}</p>)}
        </div>
      )}

      {groupSlotsByPeriod(plan.slots).map(({ matchIndex, periodIndex, slots: periodSlots }) => {
        return (
          <div key={`${matchIndex}:${periodIndex}`}>
            <h2 className="text-lg font-semibold mb-2">Match {matchIndex + 1} · Period {periodIndex + 1}</h2>
            <div className="grid grid-cols-1 gap-2">
              {periodSlots.map((slot, idx) => {
                const next = periodSlots[idx + 1]
                const transition = getBoundaryTransition(slot, next)
                const goingOff = transition.off
                const gk = slot.gkId ? playerById.get(slot.gkId) : null
                return (
                  <div key={slot.id} className="border border-slate-200 rounded-xl p-3">
                    <p className="text-xs font-semibold text-slate-500 mb-1.5">
                      {formatMinute(slot.startMinute)}–{formatMinute(slot.endMinute)}
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
                    {(transition.off.length > 0 || transition.on.length > 0) && (
                      <p className="text-xs mt-1">
                        <span className="font-semibold">Next substitution at {formatMinute(slot.endMinute)}:</span>{' '}
                        Off: {transition.off.map((id) => playerById.get(id)?.name ?? id).join(', ') || '—'}
                        {' · '}On: {transition.on.map((id) => playerById.get(id)?.name ?? id).join(', ') || '—'}
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
