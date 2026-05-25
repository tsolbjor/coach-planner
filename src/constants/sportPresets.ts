import type { SportConfig } from '../types'

type GroupId = 'defender' | 'midfielder' | 'forward'

export interface LineupSlotSpec {
  positionTypeId: GroupId
  label: string
}

export interface Lineup {
  id: string
  label: string
  slots: LineupSlotSpec[]
}

export interface SportSize {
  size: number
  lineups: Lineup[]
  defaultTotalKids: number
  defaultPeriodCount: number
  defaultPeriodMinutes: number
}

export interface SportPreset {
  id: string
  name: string
  sizes: SportSize[]
}

function symmetricRow(left: string, center: string, right: string, count: number): string[] {
  switch (count) {
    case 0: return []
    case 1: return [center]
    case 2: return [left, right]
    case 3: return [left, center, right]
    case 4: return [left, center, center, right]
    case 5: return [left, center, center, center, right]
    default: return Array.from({ length: count }, (_, i) => `${center}${i + 1}`)
  }
}

function soccerLineup(defenders: number, midfielders: number, forwards: number): Lineup {
  const defs = symmetricRow('LB', 'CB', 'RB', defenders)
  const mids = symmetricRow('LM', 'CM', 'RM', midfielders)
  const fwds = symmetricRow('LW', 'ST', 'RW', forwards)
  const slots: LineupSlotSpec[] = [
    ...defs.map((label) => ({ positionTypeId: 'defender' as const, label })),
    ...mids.map((label) => ({ positionTypeId: 'midfielder' as const, label })),
    ...fwds.map((label) => ({ positionTypeId: 'forward' as const, label })),
  ]
  const id = `${defenders}-${midfielders}-${forwards}`
  return { id, label: id, slots }
}

const handball6: Lineup = {
  id: 'standard',
  label: 'Standard',
  slots: [
    { positionTypeId: 'forward', label: 'LW' },
    { positionTypeId: 'defender', label: 'LB' },
    { positionTypeId: 'defender', label: 'CB' },
    { positionTypeId: 'defender', label: 'RB' },
    { positionTypeId: 'forward', label: 'RW' },
  ],
}

const handball7: Lineup = {
  id: 'standard',
  label: 'Standard',
  slots: [
    { positionTypeId: 'forward', label: 'LW' },
    { positionTypeId: 'defender', label: 'LB' },
    { positionTypeId: 'defender', label: 'CB' },
    { positionTypeId: 'defender', label: 'RB' },
    { positionTypeId: 'forward', label: 'RW' },
    { positionTypeId: 'forward', label: 'LP' },
  ],
}

export const SPORT_PRESETS: SportPreset[] = [
  {
    id: 'soccer',
    name: 'Soccer',
    sizes: [
      {
        size: 6,
        lineups: [soccerLineup(2, 1, 2), soccerLineup(1, 2, 2), soccerLineup(2, 2, 1), soccerLineup(1, 3, 1)],
        defaultTotalKids: 8,
        defaultPeriodCount: 2,
        defaultPeriodMinutes: 20,
      },
      {
        size: 7,
        lineups: [soccerLineup(2, 2, 2), soccerLineup(2, 3, 1), soccerLineup(3, 2, 1), soccerLineup(1, 3, 2)],
        defaultTotalKids: 9,
        defaultPeriodCount: 2,
        defaultPeriodMinutes: 25,
      },
      {
        size: 9,
        lineups: [soccerLineup(3, 3, 2), soccerLineup(2, 4, 2), soccerLineup(3, 4, 1), soccerLineup(2, 3, 3), soccerLineup(3, 2, 3)],
        defaultTotalKids: 12,
        defaultPeriodCount: 2,
        defaultPeriodMinutes: 30,
      },
      {
        size: 11,
        lineups: [soccerLineup(4, 3, 3), soccerLineup(4, 4, 2), soccerLineup(4, 5, 1), soccerLineup(3, 5, 2), soccerLineup(3, 4, 3)],
        defaultTotalKids: 14,
        defaultPeriodCount: 2,
        defaultPeriodMinutes: 45,
      },
    ],
  },
  {
    id: 'handball',
    name: 'Handball',
    sizes: [
      {
        size: 6,
        lineups: [handball6],
        defaultTotalKids: 9,
        defaultPeriodCount: 2,
        defaultPeriodMinutes: 20,
      },
      {
        size: 7,
        lineups: [handball7],
        defaultTotalKids: 10,
        defaultPeriodCount: 2,
        defaultPeriodMinutes: 20,
      },
    ],
  },
]

/** Default config — soccer 11-aside 4-3-3. */
export const SOCCER_PRESET: SportConfig = buildDefaultSoccer()

function buildDefaultSoccer(): SportConfig {
  const sport = SPORT_PRESETS[0]!
  const size = sport.sizes.find((s) => s.size === 11) ?? sport.sizes[0]!
  const lineup = size.lineups[0]!
  return buildSportConfigFromLineup(sport, size, lineup)
}

export function buildSportConfigFromLineup(
  sport: SportPreset,
  size: SportSize,
  lineup: Lineup,
): SportConfig {
  // Build positionTypes from the lineup's specific position labels (GK, LB, CB, ...).
  // Slots that share the same label collapse to one positionType so player exclusions
  // (e.g. "can play CB") apply consistently.
  const positionTypes: SportConfig['positionTypes'] = [
    { id: 'gk', label: 'Goalkeeper', shortLabel: 'GK', group: 'keeper', isKeeper: true, rotateEveryMinutes: 0 },
  ]
  const seenLabels = new Set<string>(['gk'])
  for (const spec of lineup.slots) {
    const id = spec.label.toLowerCase()
    if (seenLabels.has(id)) continue
    seenLabels.add(id)
    positionTypes.push({
      id,
      label: spec.label,
      shortLabel: spec.label,
      group: spec.positionTypeId,
      isKeeper: false,
      rotateEveryMinutes: 0,
    })
  }

  // GK first; remaining slots preserve the lineup's defined order verbatim.
  const lineupSlots: SportConfig['lineupSlots'] = [
    { slotId: 'gk', positionTypeId: 'gk', label: 'GK' },
  ]
  const slotCounter = new Map<string, number>()
  for (const spec of lineup.slots) {
    const typeId = spec.label.toLowerCase()
    const n = (slotCounter.get(typeId) ?? 0) + 1
    slotCounter.set(typeId, n)
    lineupSlots.push({
      slotId: `${typeId}_${n}`,
      positionTypeId: typeId,
      label: spec.label,
    })
  }

  return {
    presetId: sport.id === 'soccer' || sport.id === 'handball' ? sport.id : 'custom',
    name: lineup.label === 'Standard'
      ? `${sport.name} ${size.size}-a-side`
      : `${sport.name} ${size.size}-a-side · ${lineup.label}`,
    totalOnField: size.size,
    benchSize: Math.max(0, size.defaultTotalKids - size.size),
    periodCount: size.defaultPeriodCount,
    periodDurationMinutes: size.defaultPeriodMinutes,
    hasKeeper: true,
    positionTypes,
    lineupSlots,
  }
}
