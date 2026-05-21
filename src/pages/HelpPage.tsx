import { Button } from '../components/common/Button'
import { Card } from '../components/common/Card'

const sections = [
  {
    title: 'What The Plan Optimizes',
    points: [
      'The planner builds a full segment-by-segment rotation from your players, positions, match length, bench cadence, role eligibility, and player levels.',
      'It balances total pitch time across the squad (keeper time counts as pitch time) while still filling every lineup slot with an eligible player.',
      'The same input produces the same result. When you change the setup, the plan regenerates automatically.',
    ],
  },
  {
    title: 'How Rotation Works',
    points: [
      'The match is split into segments based on "Minutes on bench". A 40-minute match with 5-minute stints becomes 8 segments.',
      'For each segment, the planner picks who sits on the bench, then fills the remaining field slots with eligible players.',
      'Bench priority leans on whoever has the most pitch time so far, with fewer bench appearances as a tiebreaker — pitch time stays even across the plan.',
      'After a player comes off the bench they get at least 2 field segments before they can be benched again (no back-to-back bench, and no bench-skip-bench).',
      'Match-start and match-end fairness: across multiple matches, players who have already started or ended on the bench are pushed down the bench list at those boundaries.',
      'Bench history resets between matches, so the 2-segment field minimum applies within a match only.',
    ],
  },
  {
    title: 'Player Levels (L1 / L2 / L3)',
    points: [
      'Each player gets a level on the Players step: L1 (top), L2 (default), L3 (developing).',
      'At most one L1 player sits on the bench in any single segment, so your strongest players are rarely off the field together.',
      'If you have too many L1 players to fit (more than field size + 1), the planner will warn that the cap cannot be honoured.',
      'Levels affect bench selection only — they do not change position eligibility.',
    ],
  },
  {
    title: 'Position Continuity & Eligibility',
    points: [
      'On the Players step, every position chip is selected by default. Deselect a chip only when that player should never play there.',
      'Within a period, returning field players keep their previous slot; bench-in players take the vacated slots.',
      'At period and match boundaries, the planner re-matches positions from scratch to increase role variety.',
      'The planner will never assign a player to a position they have opted out of.',
    ],
  },
  {
    title: 'Goalkeeper Logic',
    points: [
      'The goalkeeper role has a configurable "Rotate every" value (in minutes) that controls how long each keeper stays before rotating.',
      'One keeper is designated per period; the bench picker keeps that keeper on the field for the whole period.',
      'The planner picks each period\'s keeper from players whose GK chip is still selected, preferring whoever has accumulated the fewest keeper segments.',
      'At least one keeper-eligible player is always kept on the field. If that conflicts with the L1 cap or rotation rules, the planner relaxes those rules and warns you.',
    ],
  },
  {
    title: 'When The Plan Regenerates',
    points: [
      'The plan regenerates when you change the roster, player levels, position eligibility, bench stint length, match count, or keeper rotation interval.',
      'The generated plan is visible on the Full Timeline step.',
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
