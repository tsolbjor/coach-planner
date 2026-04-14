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
      'The match is split into segments based on "Minutes on bench". A 40-minute match with 5-minute stints becomes 8 segments.',
      'For each segment, the planner decides who is on the field, who is on the bench, and which player fills each position.',
      'Players stay in the same position until they are subbed off. When they come back on, they may be placed in a different position.',
      'Players who have been benched recently are given lower bench priority, so the planner pushes toward fair bench usage over the full plan.',
    ],
  },
  {
    title: 'Position Eligibility',
    points: [
      'On the Players step, every position chip is selected by default. Deselect a chip only when that player should never play there.',
      'The planner will never assign a player to a position they have opted out of.',
      'Players who cannot play any outfield position (e.g., goalkeeper-only) are automatically benched when not in their eligible role.',
    ],
  },
  {
    title: 'Goalkeeper Logic',
    points: [
      'The goalkeeper role has a configurable "Rotate every" value (in minutes) that controls how long each goalkeeper stays before rotating.',
      'A player is eligible for goalkeeper if the GK chip stays selected on the Players page.',
      'When the goalkeeper changes during a period, the new keeper must come from the bench. The outgoing keeper then takes a bench stint.',
    ],
  },
  {
    title: 'Locking & Releasing Slots',
    points: [
      'Tap a slot in the generated plan to edit it manually. Saving locks the slot so it is preserved on regeneration.',
      'Locked slots show a lock icon. Tap "Back to auto" to release a locked slot and let the planner recalculate it.',
      'The plan regenerates automatically when you lock or release a slot.',
    ],
  },
  {
    title: 'When The Plan Regenerates',
    points: [
      'The plan regenerates when you change the roster, absences, bench stint length, match count, or position eligibility.',
      'Locking or releasing a slot also triggers regeneration.',
      'If there are no active players left, the generated plan is cleared instead of showing stale assignments.',
    ],
  },
]

function HelpContent() {
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
