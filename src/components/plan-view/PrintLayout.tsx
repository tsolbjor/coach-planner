import type { MatchPlan } from '../../types'
import { Timeline } from './Timeline'
import { getBoundaryTransition } from '../../utils/slotTransitions'
import { formatMinute, groupSlotsByPeriod } from '../../utils/slotIntervals'

interface PrintLayoutProps {
  plan: MatchPlan
}

/**
 * One A4 landscape sheet per match, meant to be folded into two A5 halves:
 * left half = the plan (timeline), right half = in-game substitutions.
 */
export function PrintLayout({ plan }: PrintLayoutProps) {
  const playerById = new Map(plan.roster.map((p) => [p.id, p]))
  const nameOf = (id: string) => playerById.get(id)?.name ?? id
  const periodGroups = groupSlotsByPeriod(plan.slots)
  const matchIndexes = [...new Set(plan.slots.map((s) => s.matchIndex))].sort((a, b) => a - b)

  return (
    <div className="print-sheets">
      {matchIndexes.map((matchIndex) => {
        const matchSlots = plan.slots.filter((s) => s.matchIndex === matchIndex)
        const matchPeriods = periodGroups.filter((g) => g.matchIndex === matchIndex)
        return (
          <section key={matchIndex} className="print-sheet">
            <div className="print-half print-half-plan">
              <div className="print-rotate">
              <h1 className="text-lg font-bold leading-tight">{plan.name}</h1>
              <h2 className="text-base font-semibold">Match {matchIndex + 1} · Plan</h2>
              <p className="text-slate-500 text-xs mb-2">
                {plan.sportConfig.name} · {plan.sportConfig.periodCount}×{plan.sportConfig.periodDurationMinutes} min ·{' '}
                {plan.benchStintMinutes} min substitution interval
              </p>
              <Timeline slots={matchSlots} sportConfig={plan.sportConfig} players={plan.roster} />
              {(plan.warnings?.length ?? 0) > 0 && (
                <div className="text-xs text-amber-800 mt-2">
                  <h3 className="font-semibold">Plan warnings</h3>
                  {plan.warnings!.map((warning, index) => <p key={index}>{warning.message}</p>)}
                </div>
              )}
              </div>
            </div>

            <div className="print-half">
              <h2 className="text-base font-semibold mb-2">Match {matchIndex + 1} · Substitutions</h2>
              {matchPeriods.map(({ periodIndex, slots: periodSlots }) => (
                <div key={periodIndex} className="mb-2">
                  <h3 className="text-sm font-semibold mb-1">Period {periodIndex + 1}</h3>
                  {periodSlots.map((slot, idx) => {
                    const transition = getBoundaryTransition(slot, periodSlots[idx + 1])
                    const gk = slot.gkId ? playerById.get(slot.gkId) : null
                    const hasChange = transition.off.length > 0 || transition.on.length > 0
                    return (
                      <div key={slot.id} className="border border-slate-300 rounded p-1.5 mb-1 text-xs">
                        <p>
                          <span className="font-semibold">
                            {formatMinute(slot.startMinute)}–{formatMinute(slot.endMinute)}
                          </span>{' '}
                          · GK: {gk?.name ?? '—'}
                        </p>
                        <p>
                          <span className="font-semibold">Field:</span>{' '}
                          {slot.fieldIds.length === 0 ? '—' : slot.fieldIds.map(nameOf).join(', ')}
                        </p>
                        {slot.benchIds.length > 0 && (
                          <p className="text-slate-500">
                            <span className="font-semibold">Bench:</span> {slot.benchIds.map(nameOf).join(', ')}
                          </p>
                        )}
                        {hasChange && (
                          <p className="mt-0.5">
                            <span className="font-semibold">Next substitution at {formatMinute(slot.endMinute)}:</span>{' '}
                            Off: {transition.off.map(nameOf).join(', ') || '—'}
                            {' · '}On: {transition.on.map(nameOf).join(', ') || '—'}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
