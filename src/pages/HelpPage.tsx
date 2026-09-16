import { Button } from '../components/common/Button'
import { Card } from '../components/common/Card'

const sections = [
  {
    title: 'Hard boundaries vs fairness guidelines',
    points: [
      'Validity comes first: only present, eligible players can fill positions. Each player has one role at a time. The planner seeks a full eligible lineup before optimizing rotation.',
      'Compatible coach edits come next. If an edit conflicts with availability, eligibility, or lineup capacity, the plan explains what could not be honored.',
      'Maximum continuous rest and returning benched players at period boundaries take priority over keeper cadence and keeper-time fairness, then substitution-count and protected-player preferences. Completed play is kept unchanged.',
      'Among rotation candidates, the longest uninterrupted playing time takes priority over equal total minutes. Equal minutes are a goal, not a guarantee; restricted positions and keeper duty can limit fairness.',
    ],
  },
  {
    title: 'What The Plan Optimizes',
    points: [
      'The planner builds a chronological rotation from your players, sport setup, substitution interval, position eligibility, and bench-group preferences.',
      'Pitch, keeper, and rest time are measured in minutes. Keeper time counts as pitch time. Position assignments favor variety at period and match boundaries.',
      'Same input → same plan. Change anything in Setup or Players and the plan re-generates automatically.',
    ],
  },
  {
    title: 'How Rotation Works',
    points: [
      'Substitution interval sets the regular opportunities for substitutions. Intervals are adjusted evenly to fit each period; Setup shows the actual duration.',
      'A keeper midpoint can add an interval boundary without adding a full round of substitutions. Timeline, live view, and print show the same intervals.',
      'The planner checks that its chosen players can cover the positions. Position continuity is relaxed when necessary to fill an eligible lineup.',
      'At regular substitution boundaries, the planner tries to keep the rotation moving rather than leaving the same bench group parked.',
      'Maximum continuous rest defaults to one regular substitution interval. Keeper-only boundaries do not reset rest time for players who remain benched.',
      'Players who finish a period or match on the bench are brought back onto the field at the next period or match start when possible.',
      'Continuous rest resets between matches, while accumulated playing and keeper time carry forward.',
    ],
  },
  {
    title: 'Bench-Group Preferences',
    points: [
      'Choose Protected for players you prefer not to bench together, or Standard for ordinary rotation.',
      'The planner prefers at most one protected player on the bench at a time. This is not a promise of extra minutes and can be relaxed for higher-priority constraints, with a warning.',
      'Existing L1 players are protected. L2 and L3 both behave as standard players; the planner does not distinguish their skill levels.',
    ],
  },
  {
    title: 'Position Continuity & Eligibility',
    points: [
      'Every position chip in Players is selected by default. Deselect a chip only when that player should never play there.',
      'Within a period, returning field players normally keep their previous slot and bench-in players take vacated slots. Players may move if needed to cover all positions.',
      'At period and match boundaries, the planner re-matches positions to rotate each player through their relevant positions.',
      'The planner will never assign a player to a position they have opted out of.',
    ],
  },
  {
    title: 'Goalkeeper & Mid-Period Swap',
    points: [
      'Normally one keeper is designated per period. Availability, eligibility, or coach edits can require a change.',
      'Enable "Change keeper mid-period" in Setup to swap keeper midway through each period when a bench keeper is available.',
      'If the midpoint falls inside a regular substitution interval, it becomes a separate boundary. The incoming keeper prepares on the bench; the outgoing keeper rests when possible.',
      'Keeper duty is spread across eligible players, preferring fewer actual keeper minutes, while preserving a feasible outfield lineup.',
    ],
  },
  {
    title: 'Editing Plan In Place',
    points: [
      'Click a timeline cell to swap field, bench, or keeper roles at that interval. A swap pins the involved players, not every unrelated assignment.',
      'Mark a player absent for this segment, rest of period, or rest of match. Toggle "counts as field time" if the absence should still credit pitch-time fairness.',
      'Unrelated absence and credited-time edits are preserved. The solver respects compatible pins and rebalances the remaining plan.',
      'In-game edits preserve earlier completed intervals. Timing changes cannot silently rewrite completed play or move existing pins to different times.',
      'Renaming a position preserves edits and eligibility. Timing changes require confirmation to clear affected pins.',
      'Clear a single future pin from the interval editor, or clear future pins from the header. Warnings stay with the saved plan and are included when printing.',
    ],
  },
]

function HelpContent() {
  return (
    <>
      <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-slate-700">
        The planner is built to be mobile-first; the core logic is deterministic: same setup in, same plan out.
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
