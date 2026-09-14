import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { MatchPlan, TimeSlot } from '../../../types'
import { makeFiveASide, makePlayers } from '../../../scheduler/__tests__/fixtures'
import { PrintLayout } from '../PrintLayout'

describe('PrintLayout', () => {
  it('prints each match separately and includes keeper midpoint instructions and warnings', () => {
    const slot: TimeSlot = {
      id: 's1', matchIndex: 0, periodIndex: 0, startMinute: 0, endMinute: 15,
      gkId: 'p2', fieldIds: [], benchIds: ['p1'],
      absentIds: [], absentCreditedIds: [], positions: { gk: 'p2' },
      midSwap: {
        atMinute: 7.5, preGkId: 'p1', preFieldIds: [], preBenchIds: ['p2'], prePositions: { gk: 'p1' },
      },
    }
    const plan: MatchPlan = {
      id: 'plan', name: 'Plan', createdAt: '', updatedAt: '',
      sportConfig: makeFiveASide({ periodCount: 1, periodDurationMinutes: 15 }),
      roster: makePlayers(2), benchStintMinutes: 5, matchCount: 2,
      slots: [slot, { ...slot, id: 's2', matchIndex: 1 }], absentPlayerIds: [], pins: {},
      changeKeeperMidPeriod: true, maxBenchSegments: 1, minSubsPerSegment: 0, maxSubsPerSegment: 1,
      warnings: [{ kind: 'low-player-count', message: 'Not enough available players.' }],
    }
    const html = renderToStaticMarkup(createElement(PrintLayout, { plan }))
    expect(html).toContain('Match 1 · Period 1')
    expect(html).toContain('Match 2 · Period 1')
    expect(html).toContain('Next substitution at 7.5&#x27;')
    expect(html).toContain('Not enough available players.')
    expect(html.match(/Next substitution at/g)).toHaveLength(2)
  })
})
