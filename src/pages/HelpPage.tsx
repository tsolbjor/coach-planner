import { Button } from '../components/common/Button'
import { Card } from '../components/common/Card'

const sections = [
  {
    title: 'What The Plan Optimizes',
    points: [
      'The planner builds a full segment-by-segment rotation from your players, sport setup, bench cadence, role eligibility, and player levels.',
      'It balances total pitch time across the squad (keeper time counts as pitch time) and rotates each player through their relevant positions across periods and matches.',
      'Same input → same plan. Change anything in Setup or Players and the plan re-generates automatically.',
    ],
  },
  {
    title: 'How Rotation Works',
    points: [
      'The match is split into segments based on "Minutes on bench". A 40-min match with 5-min stints becomes 8 segments.',
      'For each segment, the planner picks who sits on the bench then fills the remaining field slots with eligible players.',
      'Bench priority leans on whoever has the most pitch time so far, with fewer bench appearances as a tiebreaker.',
      'With the default settings, the planner avoids back-to-back bench segments for the same player.',
      'Players who finish a period or match on the bench are brought back onto the field at the next period or match start when possible.',
      'Other bench history still resets between matches.',
    ],
  },
  {
    title: 'Player Levels (L1 / L2 / L3)',
    points: [
      'On the Players modal, each player gets a level: L1 (top), L2 (default), L3 (developing).',
      'At most one L1 player sits on the bench in any single segment.',
      'If you have too many L1 players to fit (more than field size + 1), the planner warns that the cap cannot be honoured.',
    ],
  },
  {
    title: 'Position Continuity & Eligibility',
    points: [
      'Every position chip in Players is selected by default. Deselect a chip only when that player should never play there.',
      'Within a period, returning field players keep their previous slot; bench-in players take the vacated slots.',
      'At period and match boundaries, the planner re-matches positions to rotate each player through their relevant positions.',
      'The planner will never assign a player to a position they have opted out of.',
    ],
  },
  {
    title: 'Goalkeeper & Mid-Period Swap',
    points: [
      'One keeper is designated per period. The bench picker keeps that keeper on the field for the whole period.',
      'Enable "Change keeper mid-period" in Setup to swap keeper midway through each period when a bench keeper is available.',
      'For odd-segment periods, the swap happens in the middle of the swap segment so the new keeper gets half-segment prep on the bench first.',
      'The planner picks each period\'s keeper from players whose GK chip is still selected, preferring whoever has accumulated the fewest keeper segments.',
    ],
  },
  {
    title: 'Editing Plan In Place',
    points: [
      'Click any cell in the timeline to swap roles (field ↔ bench, change GK) at that exact segment.',
      'Mark a player absent for this segment, rest of period, or rest of match. Toggle "counts as field time" if the absence should still credit pitch-time fairness.',
      'Each edit becomes a "pin". The solver respects pins and re-balances forward from that segment.',
      'Clear a single pin from the Segment editor, or clear all pins from the header.',
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
