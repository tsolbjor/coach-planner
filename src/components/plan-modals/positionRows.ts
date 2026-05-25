import { nanoid } from 'nanoid'
import type { MatchPlan } from '../../types'

export type PositionRow = {
  id: string
  label: string
  positionTypeId: string
  rotateEveryMinutes: number
  group: MatchPlan['sportConfig']['positionTypes'][number]['group']
}

export function makePositionRow(index: number): PositionRow {
  return {
    id: `pos_${nanoid(4)}`,
    label: index === 0 ? 'GK' : `P${index + 1}`,
    positionTypeId: index === 0 ? 'gk' : 'forward',
    rotateEveryMinutes: 0,
    group: index === 0 ? 'keeper' : 'forward',
  }
}

export function rowsFromSportConfig(sportConfig: MatchPlan['sportConfig']): PositionRow[] {
  return sportConfig.lineupSlots.map((slot, index) => {
    const position = sportConfig.positionTypes.find((type) => type.id === slot.positionTypeId)
    return {
      id: slot.slotId,
      label: index === 0 ? 'GK' : slot.label,
      positionTypeId: slot.positionTypeId,
      rotateEveryMinutes: position?.rotateEveryMinutes ?? 0,
      group: index === 0 ? 'keeper' : (position?.group ?? 'other'),
    }
  })
}

export function ensurePositionCount(rows: PositionRow[], count: number): PositionRow[] {
  const sliced = rows.slice(0, count)
  const next = [...sliced]
  while (next.length < count) next.push(makePositionRow(next.length))
  return next.map((row, index) => ({
    ...row,
    label: index === 0 ? 'GK' : row.label,
    positionTypeId: index === 0 ? 'gk' : row.positionTypeId,
    group: index === 0 ? 'keeper' : row.group,
  }))
}

export function buildSportConfigFromRows(
  positions: PositionRow[],
  totalPlayers: number,
  periodCount: number,
  periodDurationMinutes: number,
): MatchPlan['sportConfig'] {
  const normalizedPositions = positions.map((position, index) => {
    const label = index === 0 ? 'GK' : position.label.trim() || `P${index + 1}`
    return {
      ...position,
      label,
      positionTypeId: index === 0 ? 'gk' : label.toLowerCase(),
      group: index === 0 ? ('keeper' as const) : position.group,
    }
  })
  const bench = Math.max(0, totalPlayers - normalizedPositions.length)

  const positionTypes: MatchPlan['sportConfig']['positionTypes'] = []
  const seen = new Set<string>()
  for (const position of normalizedPositions) {
    if (seen.has(position.positionTypeId)) continue
    seen.add(position.positionTypeId)
    positionTypes.push({
      id: position.positionTypeId,
      label: position.positionTypeId === 'gk' ? 'Goalkeeper' : position.label,
      shortLabel: position.label,
      group: position.group,
      isKeeper: position.positionTypeId === 'gk',
      rotateEveryMinutes: 0,
    })
  }

  const slotCounter = new Map<string, number>()
  return {
    presetId: 'custom',
    name: `${normalizedPositions.length}-a-side`,
    totalOnField: normalizedPositions.length,
    benchSize: bench,
    periodCount,
    periodDurationMinutes,
    hasKeeper: true,
    positionTypes,
    lineupSlots: normalizedPositions.map((position) => {
      const n = (slotCounter.get(position.positionTypeId) ?? 0) + 1
      slotCounter.set(position.positionTypeId, n)
      return {
        slotId: `${position.positionTypeId}_${n}`,
        positionTypeId: position.positionTypeId,
        label: position.label,
      }
    }),
  }
}

export function buildRosterForTotalPlayers(
  roster: MatchPlan['roster'],
  totalPlayers: number,
  defaultLevel: MatchPlan['roster'][number]['level'],
): MatchPlan['roster'] {
  if (totalPlayers <= roster.length) return roster.slice(0, totalPlayers)
  const next = [...roster]
  for (let i = roster.length; i < totalPlayers; i++) {
    next.push({
      id: nanoid(8),
      name: `Player ${i + 1}`,
      level: defaultLevel,
      excludedPositionTypeIds: [],
    })
  }
  return next
}
