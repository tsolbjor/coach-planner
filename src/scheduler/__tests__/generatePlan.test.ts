import { describe, it, expect } from 'vitest'
import { generatePlan } from '..'
import { makeFiveASide, makePlayers } from './fixtures'
import type { Player, TimeSlot } from '../../types'
import { getPlayerPitchMinutes, getPlayerPitchMinutesForSlot } from '../../utils/pitchTime'

function pitchTime(slots: TimeSlot[], playerId: string): number {
  return getPlayerPitchMinutes(slots, playerId)
}

function benchCount(slots: TimeSlot[], playerId: string): number {
  return slots.filter((s) => s.benchIds.includes(playerId)).length
}

function onFieldIds(slot: TimeSlot): string[] {
  return [slot.gkId, ...slot.fieldIds].filter((id): id is string => !!id)
}

function consecutiveOnFieldStreak(slots: TimeSlot[], upToIndex: number, playerId: string): number {
  let streak = 0
  for (let i = upToIndex; i >= 0; i--) {
    const slot = slots[i]!
    if (onFieldIds(slot).includes(playerId)) streak += 1
    else break
  }
  return streak
}

function keeperStintsByMatch(slots: TimeSlot[]): string[] {
  const keeperIds: string[] = []
  let previousMatch = -1
  let previousKeeper: string | null = null
  for (const slot of slots) {
    if (slot.matchIndex !== previousMatch) previousKeeper = null
    const preKeeper = slot.midSwap?.preGkId ?? slot.gkId
    if (preKeeper && preKeeper !== previousKeeper) keeperIds.push(preKeeper)
    if (slot.gkId && slot.gkId !== preKeeper) keeperIds.push(slot.gkId)
    previousKeeper = slot.gkId
    previousMatch = slot.matchIndex
  }
  return keeperIds
}

describe('generatePlan (integration)', () => {
  it('7 players, 5 on field, 2 periods × 4 segments — pitch time within ±1 segment', () => {
    const sport = makeFiveASide({ periodCount: 2, periodDurationMinutes: 20 })
    const result = generatePlan({
      sportConfig: sport,
      players: makePlayers(7),
      benchStintMinutes: 5,
      matchCount: 1,
    })
    const minutes = makePlayers(7).map((p) => pitchTime(result.slots, p.id))
    expect(Math.max(...minutes) - Math.min(...minutes)).toBeLessThanOrEqual(5)
  })

  it('6 players, 5 on field, 4 segments — no back-to-back bench', () => {
    const sport = makeFiveASide({ periodCount: 1, periodDurationMinutes: 20 })
    const result = generatePlan({
      sportConfig: sport,
      players: makePlayers(6),
      benchStintMinutes: 5,
      matchCount: 1,
    })
    expect(result.slots).toHaveLength(4)
    for (let i = 1; i < result.slots.length; i++) {
      const prev = new Set(result.slots[i - 1]!.benchIds)
      for (const id of result.slots[i]!.benchIds) expect(prev.has(id)).toBe(false)
    }
  })

  it('players benched at period end return for the next period start even with loose bench caps', () => {
    const sport = makeFiveASide({ periodCount: 2, periodDurationMinutes: 10 })
    const result = generatePlan({
      sportConfig: sport,
      players: makePlayers(7),
      benchStintMinutes: 5,
      matchCount: 1,
      maxBenchSegments: 3,
    })
    const periodOneEnd = result.slots.find((slot) => slot.periodIndex === 0 && slot.endMinute === 10)!
    const periodTwoStart = result.slots.find((slot) => slot.periodIndex === 1 && slot.startMinute === 10)!
    const nextOnField = new Set([...(periodTwoStart.gkId ? [periodTwoStart.gkId] : []), ...periodTwoStart.fieldIds])
    for (const benchedId of periodOneEnd.benchIds) {
      expect(nextOnField.has(benchedId)).toBe(true)
    }
  })

  it('5 players exactly fills field — warning + no bench', () => {
    const sport = makeFiveASide({ periodCount: 1, periodDurationMinutes: 20 })
    const result = generatePlan({
      sportConfig: sport,
      players: makePlayers(5),
      benchStintMinutes: 5,
      matchCount: 1,
    })
    expect(result.warnings.map((w) => w.kind)).toContain('bench-rotation-impossible')
    for (const slot of result.slots) {
      expect(slot.benchIds).toEqual([])
      const fieldTotal = (slot.gkId ? 1 : 0) + slot.fieldIds.length
      expect(fieldTotal).toBe(5)
    }
  })

  it('no player both on field and bench at same segment', () => {
    const sport = makeFiveASide({ periodCount: 1, periodDurationMinutes: 20 })
    const result = generatePlan({
      sportConfig: sport,
      players: makePlayers(8),
      benchStintMinutes: 5,
      matchCount: 1,
    })
    for (const slot of result.slots) {
      const onField = new Set([...(slot.gkId ? [slot.gkId] : []), ...slot.fieldIds])
      for (const id of slot.benchIds) expect(onField.has(id)).toBe(false)
      expect(new Set(slot.fieldIds).size).toBe(slot.fieldIds.length)
    }
  })

  it('multi-match tournament — pitch time balanced', () => {
    const sport = makeFiveASide({ periodCount: 1, periodDurationMinutes: 20 })
    const result = generatePlan({
      sportConfig: sport,
      players: makePlayers(7),
      benchStintMinutes: 5,
      matchCount: 3,
    })
    const minutes = makePlayers(7).map((p) => pitchTime(result.slots, p.id))
    // ±2 segments across 3 matches with default (flexible) rotation settings.
    expect(Math.max(...minutes) - Math.min(...minutes)).toBeLessThanOrEqual(15)
  })

  it('players benched at match end return for the next match start even with loose bench caps', () => {
    const sport = makeFiveASide({ periodCount: 1, periodDurationMinutes: 10 })
    const result = generatePlan({
      sportConfig: sport,
      players: makePlayers(7),
      benchStintMinutes: 5,
      matchCount: 2,
      maxBenchSegments: 3,
    })
    const matchOneEnd = result.slots.filter((slot) => slot.matchIndex === 0).at(-1)!
    const matchTwoStart = result.slots.find((slot) => slot.matchIndex === 1 && slot.startMinute === 0)!
    const nextOnField = new Set([...(matchTwoStart.gkId ? [matchTwoStart.gkId] : []), ...matchTwoStart.fieldIds])
    for (const benchedId of matchOneEnd.benchIds) {
      expect(nextOnField.has(benchedId)).toBe(true)
    }
  })

  it('keeps at least one bench change per segment when bench spots exist', () => {
    const sport = makeFiveASide({ periodCount: 1, periodDurationMinutes: 20 })
    const result = generatePlan({
      sportConfig: sport,
      players: makePlayers(7),
      benchStintMinutes: 5,
      matchCount: 1,
      maxBenchSegments: 4,
      minSubsPerSegment: 0,
      maxSubsPerSegment: 2,
    })

    for (let i = 1; i < result.slots.length; i++) {
      const prevBench = new Set(result.slots[i - 1]!.benchIds)
      const currBench = new Set(result.slots[i]!.benchIds)
      const unchanged = result.slots[i]!.benchIds.filter((id) => prevBench.has(id)).length
      expect(unchanged).toBeLessThan(currBench.size)
    }
  })

  it('gk pin honoured at exact segment', () => {
    const sport = makeFiveASide({ periodCount: 1, periodDurationMinutes: 20 })
    const players = makePlayers(7)
    const result = generatePlan({
      sportConfig: sport,
      players,
      benchStintMinutes: 5,
      matchCount: 1,
      pins: { 2: { gkId: 'p7' } },
    })
    expect(result.slots[2]!.gkId).toBe('p7')
  })

  it('bench pin honoured at exact segment', () => {
    const sport = makeFiveASide({ periodCount: 1, periodDurationMinutes: 20 })
    const players = makePlayers(7)
    const result = generatePlan({
      sportConfig: sport,
      players,
      benchStintMinutes: 5,
      matchCount: 1,
      pins: { 0: { benchIds: ['p6', 'p7'] } },
    })
    expect(result.slots[0]!.benchIds).toEqual(['p6', 'p7'])
    const fieldSet = new Set([...(result.slots[0]!.gkId ? [result.slots[0]!.gkId] : []), ...result.slots[0]!.fieldIds])
    expect(fieldSet.has('p6')).toBe(false)
    expect(fieldSet.has('p7')).toBe(false)
  })

  it('bench pin is considered before choosing an unpinned keeper', () => {
    const sport = makeFiveASide({ periodCount: 1, periodDurationMinutes: 20 })
    const players = makePlayers(7)
    // The preferred keeper is not a constraint: another eligible player can keep.
    const result = generatePlan({
      sportConfig: sport,
      players,
      benchStintMinutes: 5,
      matchCount: 1,
      pins: { 0: { benchIds: ['p1', 'p7'] } },
    })
    const slot = result.slots[0]!
    const fieldTotal = (slot.gkId ? 1 : 0) + slot.fieldIds.length
    expect(fieldTotal).toBe(sport.totalOnField)
    expect(slot.benchIds.length).toBe(players.length - sport.totalOnField)
    // gkId must not appear in bench.
    if (slot.gkId) expect(slot.benchIds).not.toContain(slot.gkId)
    expect(slot.benchIds).toEqual(['p1', 'p7'])
    expect(result.warnings.map((w) => w.kind)).not.toContain('lock-conflict')
  })

  it('bench pin plus absence trims bench to keep a full lineup', () => {
    const sport = makeFiveASide({ periodCount: 1, periodDurationMinutes: 20 })
    const result = generatePlan({
      sportConfig: sport,
      players: makePlayers(7),
      benchStintMinutes: 5,
      matchCount: 1,
      pins: { 0: { benchIds: ['p6', 'p7'], absentIds: ['p1'] } },
    })
    const slot = result.slots[0]!
    const fieldTotal = (slot.gkId ? 1 : 0) + slot.fieldIds.length
    expect(fieldTotal).toBe(sport.totalOnField)
    expect(slot.benchIds).toHaveLength(1)
    expect(result.warnings.map((w) => w.kind)).toContain('lock-conflict')
  })

  it('player excluded from outfield positions still keeps pitch time via gk', () => {
    const sport = makeFiveASide({ periodCount: 1, periodDurationMinutes: 20 })
    const players: Player[] = makePlayers(7)
    players[0]!.excludedPositionTypeIds = ['def', 'mid', 'fwd']
    const result = generatePlan({
      sportConfig: sport,
      players,
      benchStintMinutes: 5,
      matchCount: 1,
    })
    expect(pitchTime(result.slots, 'p1')).toBeGreaterThan(0)
  })

  it('warns when player eligibility cannot fill all outfield positions', () => {
    const sport = makeFiveASide({ periodCount: 1, periodDurationMinutes: 20 })
    const players: Player[] = makePlayers(5)
    for (const player of players) player.excludedPositionTypeIds = ['fwd']
    const result = generatePlan({
      sportConfig: sport,
      players,
      benchStintMinutes: 5,
      matchCount: 1,
    })
    expect(result.warnings.map((warning) => warning.kind)).toContain('position-unavailable')
  })

  it('A10: never bench two L1 players at once', () => {
    const sport = makeFiveASide({ periodCount: 1, periodDurationMinutes: 20 })
    const players: Player[] = [
      ...makePlayers(2, { level: 1 }),
      ...makePlayers(5, { level: 2 }),
    ]
    players.forEach((p, i) => (p.id = `p${i + 1}`))
    const l1Ids = new Set(['p1', 'p2'])
    const result = generatePlan({
      sportConfig: sport,
      players,
      benchStintMinutes: 5,
      matchCount: 1,
    })
    for (const slot of result.slots) {
      expect(slot.benchIds.filter((id) => l1Ids.has(id)).length).toBeLessThanOrEqual(1)
    }
  })

  it('keeper rotation when only 2 eligible', () => {
    const sport = makeFiveASide({ periodCount: 2, periodDurationMinutes: 20 })
    const players: Player[] = makePlayers(7)
    for (let i = 2; i < players.length; i++) players[i]!.excludedPositionTypeIds = ['gk']
    const result = generatePlan({
      sportConfig: sport,
      players,
      benchStintMinutes: 5,
      matchCount: 2,
    })
    const minutes = new Map<string, number>()
    for (const slot of result.slots) {
      if (slot.gkId) minutes.set(slot.gkId, (minutes.get(slot.gkId) ?? 0) + slot.endMinute - slot.startMinute)
    }
    expect(Math.abs((minutes.get('p1') ?? 0) - (minutes.get('p2') ?? 0))).toBeLessThanOrEqual(20)
  })

  it('gives every keeper-eligible player one stint before repeats', () => {
    const sport = makeFiveASide({ periodCount: 1, periodDurationMinutes: 10 })
    const players: Player[] = makePlayers(8)
    const result = generatePlan({
      sportConfig: sport,
      players,
      benchStintMinutes: 10,
      matchCount: 10,
    })

    const firstEightKeeperIds = result.slots.slice(0, 8).map((slot) => slot.gkId)
    expect(firstEightKeeperIds.every((id): id is string => !!id)).toBe(true)
    expect(new Set(firstEightKeeperIds).size).toBe(8)
  })

  it.each([15, 20])(
    'gives every keeper-eligible player one stint before midpoint-swap repeats (%i minute periods)',
    (periodDurationMinutes) => {
      const sport = makeFiveASide({ periodCount: 1, periodDurationMinutes })
      const players: Player[] = makePlayers(8)
      const result = generatePlan({
        sportConfig: sport,
        players,
        benchStintMinutes: 5,
        matchCount: 4,
        changeKeeperMidPeriod: true,
      })

      const firstCycle = keeperStintsByMatch(result.slots).slice(0, players.length)
      expect(firstCycle).toHaveLength(players.length)
      expect(new Set(firstCycle).size).toBe(players.length)
    },
  )

  it('keeper tie-breaking carries across matches instead of resetting to id order', () => {
    const sport = makeFiveASide({ periodCount: 1, periodDurationMinutes: 10 })
    const players: Player[] = makePlayers(6)
    for (let i = 2; i < players.length; i++) players[i]!.excludedPositionTypeIds = ['gk']
    const result = generatePlan({
      sportConfig: sport,
      players,
      benchStintMinutes: 10,
      matchCount: 3,
      pins: {
        0: { gkId: 'p2' },
        1: { gkId: 'p1' },
      },
    })

    expect(result.slots[2]!.gkId).toBe('p2')
  })

  it('does not force the outgoing keeper onto bench when switching at period boundary', () => {
    const sport = makeFiveASide({ periodCount: 2, periodDurationMinutes: 10 })
    const players: Player[] = makePlayers(6)
    for (let i = 2; i < players.length; i++) players[i]!.excludedPositionTypeIds = ['gk']
    const result = generatePlan({
      sportConfig: sport,
      players,
      benchStintMinutes: 5,
      matchCount: 1,
      pins: {
        1: { gkId: 'p1' },
        2: { gkId: 'p2', fieldIds: ['p1', 'p3', 'p4', 'p5'] },
      },
    })

    expect(result.slots[2]!.gkId).toBe('p2')
    expect(result.slots[2]!.fieldIds).toContain('p1')
    expect(result.slots[2]!.benchIds).not.toContain('p1')
  })

  it('does not force incoming boundary keeper onto prior bench when pinned on field', () => {
    const sport = makeFiveASide({ periodCount: 2, periodDurationMinutes: 10 })
    const players: Player[] = makePlayers(7)
    const result = generatePlan({
      sportConfig: sport,
      players,
      benchStintMinutes: 5,
      matchCount: 1,
      pins: {
        1: { gkId: 'p2' },
        0: { fieldIds: ['p2', 'p3', 'p4', 'p5'] },
      },
    })

    expect(result.slots[0]!.fieldIds).toContain('p2')
    expect(result.slots[0]!.benchIds).not.toContain('p2')
    expect(result.slots[1]!.gkId).toBe('p2')
  })

  it('odd keeper midpoint becomes two ordinary intervals with exact pitch time', () => {
    const sport = makeFiveASide({ periodCount: 1, periodDurationMinutes: 15 })
    const result = generatePlan({
      sportConfig: sport,
      players: makePlayers(6),
      benchStintMinutes: 5,
      matchCount: 1,
      changeKeeperMidPeriod: true,
    })
    expect(result.slots.map(s => [s.startMinute, s.endMinute])).toEqual([[0, 5], [5, 7.5], [7.5, 10], [10, 15]])
    expect(result.slots.every(s => !s.midSwap)).toBe(true)
    const before = result.slots[1]!
    const after = result.slots[2]!
    const outgoing = before.gkId
    const incoming = after.gkId
    expect(outgoing).toBeTruthy()
    expect(incoming).toBeTruthy()
    expect(outgoing).not.toBe(incoming)
    expect(before.benchIds).toContain(incoming!)
    expect(after.benchIds).toContain(outgoing!)
    expect(getPlayerPitchMinutesForSlot(before, outgoing!) + getPlayerPitchMinutesForSlot(after, outgoing!)).toBe(2.5)
    expect(getPlayerPitchMinutesForSlot(before, incoming!) + getPlayerPitchMinutesForSlot(after, incoming!)).toBe(2.5)
  })

  it('pinned keeper on odd mid-swap segment is prepared from bench before entering', () => {
    const sport = makeFiveASide({ periodCount: 1, periodDurationMinutes: 20 })
    const result = generatePlan({
      sportConfig: sport,
      players: makePlayers(6),
      benchStintMinutes: 4,
      matchCount: 1,
      changeKeeperMidPeriod: true,
      pins: {
        1: { gkId: 'p1' },
        3: { gkId: 'p6' },
      },
    })

    const slot = result.slots[3]!
    expect(slot.gkId).toBe('p6')
    expect(slot.startMinute).toBe(10)
    expect(slot.midSwap).toBeUndefined()
    expect(result.slots[2]!.benchIds).toContain('p6')
    expect(result.slots[2]!.gkId).toBe('p1')
    expect(slot.benchIds).toContain('p1')
  })

  it('warns when a requested keeper mid-period swap cannot happen', () => {
    const sport = makeFiveASide({ periodCount: 1, periodDurationMinutes: 20 })
    const players: Player[] = makePlayers(6)
    for (let i = 1; i < players.length; i++) players[i]!.excludedPositionTypeIds = ['gk']
    const result = generatePlan({
      sportConfig: sport,
      players,
      benchStintMinutes: 5,
      matchCount: 1,
      changeKeeperMidPeriod: true,
    })

    expect(result.warnings.some((warning) => warning.message.includes('Keeper mid-period swap skipped'))).toBe(true)
  })

  it('determinism: same input produces same shape', () => {
    const sport = makeFiveASide()
    const a = generatePlan({ sportConfig: sport, players: makePlayers(7), benchStintMinutes: 5, matchCount: 2 })
    const b = generatePlan({ sportConfig: sport, players: makePlayers(7), benchStintMinutes: 5, matchCount: 2 })
    expect(a.slots.map((s) => ({ gk: s.gkId, f: s.fieldIds, b: s.benchIds }))).toEqual(
      b.slots.map((s) => ({ gk: s.gkId, f: s.fieldIds, b: s.benchIds })),
    )
  })

  it('benchCount roughly equal across players', () => {
    const sport = makeFiveASide({ periodCount: 1, periodDurationMinutes: 20 })
    const result = generatePlan({
      sportConfig: sport,
      players: makePlayers(7),
      benchStintMinutes: 5,
      matchCount: 1,
    })
    const counts = makePlayers(7).map((p) => benchCount(result.slots, p.id))
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(2)
  })

  it('keeps exact on-field count whenever active players are enough', () => {
    const sport = makeFiveASide({ periodCount: 2, periodDurationMinutes: 20 })
    const players = makePlayers(8)
    const result = generatePlan({
      sportConfig: sport,
      players,
      benchStintMinutes: 5,
      matchCount: 1,
      pins: {
        1: { absentIds: ['p8'] },
        3: { absentCreditedIds: ['p7'] },
        4: { benchIds: ['p2', 'p3', 'p6'] },
      },
    })

    for (const slot of result.slots) {
      const activeCount = players.length - new Set(slot.absentIds).size
      const onFieldCount = onFieldIds(slot).length
      if (activeCount >= sport.totalOnField) expect(onFieldCount).toBe(sport.totalOnField)
    }
  })

  it('prefers subbing longest current on-field streak and protects recent returners', () => {
    const baseSport = makeFiveASide({ periodCount: 1, periodDurationMinutes: 25 })
    const sport = {
      ...baseSport,
      hasKeeper: false,
      totalOnField: 4,
      positionTypes: baseSport.positionTypes.filter((positionType) => !positionType.isKeeper),
      lineupSlots: baseSport.lineupSlots.filter((slot) => slot.slotId !== 'gk'),
    }
    const result = generatePlan({
      sportConfig: sport,
      players: makePlayers(8),
      benchStintMinutes: 5,
      matchCount: 1,
      maxBenchSegments: 4,
      minSubsPerSegment: 1,
      maxSubsPerSegment: 2,
    })

    for (let i = 1; i < result.slots.length; i++) {
      const prev = result.slots[i - 1]!
      const curr = result.slots[i]!
      if (curr.matchIndex !== prev.matchIndex) continue

      const prevFieldCandidates = onFieldIds(prev)
      const currentlyBenched = new Set(curr.benchIds)
      const newlyBenched = prevFieldCandidates.filter((id) => currentlyBenched.has(id))
      const stayedOnField = prevFieldCandidates.filter((id) => !currentlyBenched.has(id))
      if (newlyBenched.length === 0 || stayedOnField.length === 0) continue

      const benchedStreaks = newlyBenched.map((id) => consecutiveOnFieldStreak(result.slots, i - 1, id))
      const stayedStreaks = stayedOnField.map((id) => consecutiveOnFieldStreak(result.slots, i - 1, id))
      expect(Math.min(...benchedStreaks)).toBeGreaterThanOrEqual(Math.max(...stayedStreaks))

      if (i >= 2) {
        const twoBackBench = new Set(result.slots[i - 2]!.benchIds)
        for (const id of newlyBenched) {
          const wasBenchedTwoBack = twoBackBench.has(id)
          const wasOnFieldPrev = onFieldIds(prev).includes(id)
          if (wasBenchedTwoBack && wasOnFieldPrev) {
            expect.fail(`Player ${id} bounced bench→field→bench too quickly`)
          }
        }
      }
    }
  })

  it('position overlay fills every outfield slot for healthy roster', () => {
    const sport = makeFiveASide({ periodCount: 1, periodDurationMinutes: 20 })
    const result = generatePlan({
      sportConfig: sport,
      players: makePlayers(8),
      benchStintMinutes: 5,
      matchCount: 1,
    })
    for (const slot of result.slots) {
      for (const ls of sport.lineupSlots) {
        expect(slot.positions[ls.slotId]).toBeTruthy()
      }
    }
  })

  it('within period, position continuity for returning field players', () => {
    const sport = makeFiveASide({ periodCount: 1, periodDurationMinutes: 20 })
    const result = generatePlan({
      sportConfig: sport,
      players: makePlayers(7),
      benchStintMinutes: 5,
      matchCount: 1,
    })
    for (let i = 1; i < result.slots.length; i++) {
      const prev = result.slots[i - 1]!.positions
      const curr = result.slots[i]!.positions
      const prevSlotByPlayer = new Map<string, string>()
      for (const [slotId, pid] of Object.entries(prev)) if (pid) prevSlotByPlayer.set(pid, slotId)
      for (const [slotId, pid] of Object.entries(curr)) {
        if (!pid) continue
        const prevSlot = prevSlotByPlayer.get(pid)
        if (prevSlot) expect(slotId).toBe(prevSlot)
      }
    }
  })
})
