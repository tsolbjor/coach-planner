import { Button } from '../components/common/Button'
import { Card } from '../components/common/Card'

const sections = [
  {
    title: 'What The Plan Optimizes',
    points: [
      'The planner builds a full segment-by-segment rotation from your players, positions, match length, bench cadence, and role eligibility.',
      'It tries to keep minutes balanced across the squad while still filling every lineup slot with an eligible player.',
      'The same input produces the same result. When you change the setup, the plan regenerates automatically.',
    ],
  },
  {
    title: 'How Rotation Works',
    points: [
      'The match is split into segments based on `Minutes on bench`. A 40 minute match with 5 minute stints becomes 8 segments.',
      'For each segment, the planner decides who is on the field, who is on the bench, and which player fills each position.',
      'Players who have been benched recently are given lower bench priority, so the planner keeps pushing toward fair bench usage over the full plan.',
    ],
  },
  {
    title: 'Position Rules',
    points: [
      'On the Players step, every position chip is selected by default. Deselect a chip only when that player should never be used there.',
      'If a player can cover multiple positions, the planner now prefers to vary their role across the segments they stay on the pitch.',
      'If a player is the only realistic fit for a slot, the planner will keep using them there. Plan validity wins over variety.',
    ],
  },
  {
    title: 'Rotate By',
    points: [
      'Each position can have its own `Rotate by` value in minutes.',
      'A positive value means the player in that slot should stay there for at least that many minutes before the planner is allowed to rotate the role.',
      'This is useful for positions like goalkeeper, where you may want longer stints than the general bench cadence.',
    ],
  },
  {
    title: 'Goalkeeper Logic',
    points: [
      'Goalkeeper is configured the same way as every other role. A player is eligible if the `GK` chip stays selected on the Players page.',
      'If goalkeeper changes during a period, the new goalkeeper must come from the previous segment bench. The outgoing goalkeeper then goes to the bench for that segment.',
      'That keeps goalkeeper changes more realistic without needing a separate special player mode.',
    ],
  },
  {
    title: 'When The Plan Changes',
    points: [
      'The plan regenerates when you change the roster, absences, bench stint length, match count, position eligibility, or any position `Rotate by` value.',
      'Manual edits in the generated step can still be used to adjust specific slots after generation.',
      'If there are no active players left, the generated plan is cleared instead of showing stale assignments.',
    ],
  },
]

export function HelpContent() {
  return (
    <>
      <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-slate-700">
        The planner is built to be mobile-first, but the core logic is deterministic: same setup in, same plan out.
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {sections.map((section) => (
          <Card key={section.title} className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900">{section.title}</h2>
            <div className="space-y-2 text-sm text-slate-600">
              {section.points.map((point) => (
                <p key={point}>{point}</p>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </>
  )
}

export function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 p-3 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.25)]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Help</p>
            <h1 className="mt-1 text-xl font-bold text-slate-900">How Rotation Planning Works</h1>
          </div>
          <Button size="sm" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
          <HelpContent />
        </div>
      </div>
    </div>
  )
}
