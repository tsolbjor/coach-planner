import { describe, it, expect } from 'vitest'
import { assignPositions } from '../positionAssign'
import { scheduleBench } from '../benchSchedule'
import { planKeepers } from '../keeperPlan'
import { buildSegments } from '../segmentBuilder'
import { makeFiveASide, makePlayers } from './fixtures'

function buildFor(
  playerCount: number,
  matchCount = 1,
  periodCount = 2,
  periodDurationMinutes = 20,
) {
  const sport = makeFiveASide({ periodCount, periodDurationMinutes })
  const segments = buildSegments(sport, 5, matchCount)
  const players = makePlayers(playerCount)
  const keeperPlan = planKeepers({
    sportConfig: sport,
    players,
    segments,
    lockedKeeper: new Map(),
  })
  const forcedField = new Map<number, Set<string>>()
  for (const seg of segments) {
    const id = keeperPlan.keeperByPeriod.get(`${seg.matchIndex}:${seg.periodIndex}`)
    if (id) forcedField.set(seg.segmentIndex, new Set([id]))
  }
  const bench = scheduleBench({
    sportConfig: sport,
    players,
    segments,
    locks: new Map(),
    forcedField,
  })
  const pos = assignPositions({
    sportConfig: sport,
    players,
    segments,
    benchBySegment: bench.benchBySegment,
    keeperByPeriod: keeperPlan.keeperByPeriod,
    lockedAssignments: new Map(),
  })
  return { sport, segments, players, keeperPlan, bench, pos }
}

describe('assignPositions', () => {
  it('fills every outfield slot when enough players available', () => {
    const { sport, segments, pos } = buildFor(8)
    for (const seg of segments) {
      const assigns = pos.assignmentsBySegment.get(seg.segmentIndex)!
      for (const slot of sport.lineupSlots) {
        expect(assigns[slot.slotId]).toBeTruthy()
      }
    }
  })

  it('keeper stays the same for whole period (A4)', () => {
    const { segments, pos } = buildFor(7, 1, 2)
    // Group segments by period
    const byPeriod = new Map<string, string[]>()
    for (const seg of segments) {
      const assigns = pos.assignmentsBySegment.get(seg.segmentIndex)!
      const key = `${seg.matchIndex}:${seg.periodIndex}`
      const list = byPeriod.get(key) ?? []
      list.push(assigns['gk'] ?? '')
      byPeriod.set(key, list)
    }
    for (const list of byPeriod.values()) {
      const unique = new Set(list)
      expect(unique.size).toBe(1)
    }
  })

  it('within period, a player on field in two consecutive segments stays in the same slot (A4)', () => {
    const { segments, pos } = buildFor(7, 1, 2)
    const segsByPeriod = new Map<string, typeof segments>()
    for (const seg of segments) {
      const k = `${seg.matchIndex}:${seg.periodIndex}`
      const arr = segsByPeriod.get(k) ?? []
      arr.push(seg)
      segsByPeriod.set(k, arr)
    }
    for (const periodSegs of segsByPeriod.values()) {
      periodSegs.sort((a, b) => a.segmentIndex - b.segmentIndex)
      for (let i = 1; i < periodSegs.length; i++) {
        const prev = pos.assignmentsBySegment.get(periodSegs[i - 1]!.segmentIndex)!
        const curr = pos.assignmentsBySegment.get(periodSegs[i]!.segmentIndex)!
        const prevSlotByPlayer = new Map<string, string>()
        for (const [slotId, pid] of Object.entries(prev)) {
          if (pid) prevSlotByPlayer.set(pid, slotId)
        }
        for (const [slotId, pid] of Object.entries(curr)) {
          if (!pid) continue
          const prevSlot = prevSlotByPlayer.get(pid)
          if (prevSlot) {
            expect(slotId).toBe(prevSlot)
          }
        }
      }
    }
  })

  it('no player assigned to two slots same segment (A2)', () => {
    const { segments, pos } = buildFor(8)
    for (const seg of segments) {
      const assigns = pos.assignmentsBySegment.get(seg.segmentIndex)!
      const ids = Object.values(assigns).filter(Boolean) as string[]
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('respects excludedPositionTypeIds (A6)', () => {
    const sport = makeFiveASide({ periodCount: 1, periodDurationMinutes: 20 })
    const segments = buildSegments(sport, 5, 1)
    const players = makePlayers(8)
    // Player 1 excluded from forward.
    players[0]!.excludedPositionTypeIds = ['fwd']
    const keeperPlan = planKeepers({ sportConfig: sport, players, segments, lockedKeeper: new Map() })
    const forcedField = new Map<number, Set<string>>()
    for (const seg of segments) {
      const id = keeperPlan.keeperByPeriod.get(`${seg.matchIndex}:${seg.periodIndex}`)
      if (id) forcedField.set(seg.segmentIndex, new Set([id]))
    }
    const bench = scheduleBench({
      sportConfig: sport,
      players,
      segments,
      locks: new Map(),
      forcedField,
    })
    const pos = assignPositions({
      sportConfig: sport,
      players,
      segments,
      benchBySegment: bench.benchBySegment,
      keeperByPeriod: keeperPlan.keeperByPeriod,
      lockedAssignments: new Map(),
    })
    for (const seg of segments) {
      const assigns = pos.assignmentsBySegment.get(seg.segmentIndex)!
      expect(assigns['fwd']).not.toBe('p1')
    }
  })

  it('uses locked assignments verbatim', () => {
    const sport = makeFiveASide({ periodCount: 1, periodDurationMinutes: 20 })
    const segments = buildSegments(sport, 5, 1)
    const players = makePlayers(8)
    const lockedAssign = { gk: 'p3', def_1: 'p4', def_2: 'p5', mid: 'p6', fwd: 'p7' }
    const pos = assignPositions({
      sportConfig: sport,
      players,
      segments,
      benchBySegment: segments.map(() => ['p1', 'p2', 'p8']),
      keeperByPeriod: new Map([[`0:0`, 'p3']]),
      lockedAssignments: new Map([[0, lockedAssign]]),
    })
    expect(pos.assignmentsBySegment.get(0)).toEqual(lockedAssign)
  })

  it('determinism: same input → same output', () => {
    const a = buildFor(7)
    const b = buildFor(7)
    expect([...a.pos.assignmentsBySegment.entries()]).toEqual([...b.pos.assignmentsBySegment.entries()])
  })

  it('keeps continuity for non-conflicting slots even when bench-in player forces a swap', () => {
    // Seg0 returners pA@mid, pB@def_1, pC@def_2, pD@fwd. Seg1 benches pD (fwd), brings in pE.
    // pE is only eligible for def — so the fwd slot must be vacated by shifting a returner,
    // but mid/def slots that don't conflict should still be held by the same player.
    const sport = makeFiveASide({ periodCount: 1, periodDurationMinutes: 10 })
    const segments = buildSegments(sport, 5, 1) // 2 segments × 5 min
    const players = makePlayers(7)
    // pE = p5: can only play def (excluded from mid + fwd).
    players[4]!.excludedPositionTypeIds = ['mid', 'fwd']

    const prevAssignments: Record<string, string | null> = {
      gk: 'p7',
      def_1: 'p2',
      def_2: 'p3',
      mid: 'p1',
      fwd: 'p4',
    }
    // Seg0 locked so we control prev state; seg1 bench rotates p4 out, p5 in.
    const pos = assignPositions({
      sportConfig: sport,
      players,
      segments,
      benchBySegment: [
        ['p5', 'p6'],
        ['p4', 'p6'],
      ],
      keeperByPeriod: new Map([[`0:0`, 'p7']]),
      lockedAssignments: new Map([[0, prevAssignments]]),
    })

    const seg1 = pos.assignmentsBySegment.get(1)!
    // mid: p1 not in conflict, should stay.
    expect(seg1['mid']).toBe('p1')
    // Either def_1 or def_2 may shift to accommodate p5; one of them is p5, the other stays p2 or p3.
    const defs = [seg1['def_1'], seg1['def_2']]
    expect(defs).toContain('p5')
    expect(defs.filter((id) => id === 'p2' || id === 'p3').length).toBe(1)
    // fwd: filled by whichever returner displaced from def (p2 or p3), keeper unchanged.
    expect(seg1['fwd']).toBeTruthy()
    expect(seg1['gk']).toBe('p7')
  })
})
