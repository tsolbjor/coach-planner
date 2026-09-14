import { describe, expect, it } from 'vitest'
import type { Player, TimeSlot } from '../../../types'
import { buildPlayerStatsMap } from '../Timeline'

const players: Player[] = [
  { id: 'p1', name: 'P1', level: 2, excludedPositionTypeIds: [] },
  { id: 'p2', name: 'P2', level: 2, excludedPositionTypeIds: [] },
]

function makeSlot(index: number, onFieldIds: string[]): TimeSlot {
  const benchIds = players.map((p) => p.id).filter((id) => !onFieldIds.includes(id))
  return {
    id: `s${index + 1}`,
    matchIndex: 0,
    periodIndex: 0,
    startMinute: index * 5,
    endMinute: (index + 1) * 5,
    gkId: onFieldIds[0] ?? null,
    fieldIds: [],
    benchIds,
    absentIds: [],
    absentCreditedIds: [],
    positions: {},
  }
}

describe('buildPlayerStatsMap', () => {
  it('ignores inevitable first and last runs in Min C', () => {
    const slots: TimeSlot[] = [
      makeSlot(0, ['p1']),
      makeSlot(1, ['p2']),
      makeSlot(2, ['p1']),
      makeSlot(3, ['p2']),
      makeSlot(4, ['p2']),
      makeSlot(5, ['p1']),
    ]

    const stats = buildPlayerStatsMap(slots, players)

    expect(stats.get('p1')?.minConsecutiveOnField).toBe(5)
    expect(stats.get('p2')?.minConsecutiveOnField).toBe(5)
  })

  it('returns 0 when every run touches exactly one plan edge', () => {
    const slots: TimeSlot[] = [makeSlot(0, ['p1']), makeSlot(1, ['p2']), makeSlot(2, ['p1'])]

    const stats = buildPlayerStatsMap(slots, players)

    expect(stats.get('p1')?.minConsecutiveOnField).toBe(0)
  })

  it('keeps full-plan runs in Min C', () => {
    const slots: TimeSlot[] = [makeSlot(0, ['p1']), makeSlot(1, ['p1']), makeSlot(2, ['p1'])]

    const stats = buildPlayerStatsMap(slots, players)

    expect(stats.get('p1')?.minConsecutiveOnField).toBe(15)
  })
})
