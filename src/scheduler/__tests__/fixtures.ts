import type { Player, PlayerLevel, SportConfig } from '../../types'

export function makePlayers(count: number, opts: { level?: PlayerLevel; excluded?: string[] } = {}): Player[] {
  const players: Player[] = []
  for (let i = 0; i < count; i++) {
    players.push({
      id: `p${i + 1}`,
      name: `Player ${i + 1}`,
      level: opts.level ?? 2,
      excludedPositionTypeIds: opts.excluded ?? [],
    })
  }
  return players
}

/** 5v5 sport with one keeper + 4 outfield slots, 2 periods × 20 min. */
export function makeFiveASide(overrides: Partial<SportConfig> = {}): SportConfig {
  return {
    presetId: 'custom',
    name: 'Test 5v5',
    totalOnField: 5,
    benchSize: 5,
    periodCount: 2,
    periodDurationMinutes: 20,
    hasKeeper: true,
    positionTypes: [
      { id: 'gk', label: 'Goalkeeper', shortLabel: 'GK', group: 'keeper', isKeeper: true, rotateEveryMinutes: 0 },
      { id: 'def', label: 'Defender', shortLabel: 'D', group: 'defender', isKeeper: false, rotateEveryMinutes: 0 },
      { id: 'mid', label: 'Midfielder', shortLabel: 'M', group: 'midfielder', isKeeper: false, rotateEveryMinutes: 0 },
      { id: 'fwd', label: 'Forward', shortLabel: 'F', group: 'forward', isKeeper: false, rotateEveryMinutes: 0 },
    ],
    lineupSlots: [
      { slotId: 'gk', positionTypeId: 'gk', label: 'GK' },
      { slotId: 'def_1', positionTypeId: 'def', label: 'D1' },
      { slotId: 'def_2', positionTypeId: 'def', label: 'D2' },
      { slotId: 'mid', positionTypeId: 'mid', label: 'M' },
      { slotId: 'fwd', positionTypeId: 'fwd', label: 'F' },
    ],
    ...overrides,
  }
}
