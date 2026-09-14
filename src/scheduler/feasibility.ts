import { normalizePlayerLevel, type Player, type SegmentPin, type SportConfig } from '../types'
import type { SchedulerWarning } from './types'

export interface FeasibilityInput {
  sportConfig: SportConfig
  players: Player[]
  benchStintMinutes: number
  matchCount: number
  pins: Record<number, SegmentPin>
}

export function checkFeasibility(input: FeasibilityInput): SchedulerWarning[] {
  const { sportConfig, players, benchStintMinutes, matchCount, pins } = input
  const warnings: SchedulerWarning[] = []

  if (players.length === 0) {
    warnings.push({ kind: 'low-player-count', message: 'No players in roster.' })
    return warnings
  }

  if (players.length < sportConfig.totalOnField) {
    warnings.push({
      kind: 'low-player-count',
      message: `Only ${players.length} players available, need ${sportConfig.totalOnField} on field. Some positions will be empty.`,
    })
  }

  const segmentsPerPeriod = Math.max(1, Math.round(sportConfig.periodDurationMinutes / benchStintMinutes))
  const segmentsPerMatch = segmentsPerPeriod * sportConfig.periodCount
  const totalSegments = segmentsPerMatch * matchCount
  const benchSpotsPerSeg = players.length - sportConfig.totalOnField
  const totalBenchSlots = totalSegments * Math.max(0, benchSpotsPerSeg)

  if (benchSpotsPerSeg <= 0 && players.length >= sportConfig.totalOnField) {
    warnings.push({
      kind: 'bench-rotation-impossible',
      message: 'Every player is needed on the field — no one can be benched. Add more players to allow rotation.',
    })
  } else if (totalBenchSlots > 0 && totalBenchSlots < players.length) {
    warnings.push({
      kind: 'bench-rotation-impossible',
      message: `Only ${totalBenchSlots} bench stints across the plan for ${players.length} players — not everyone can sit out once. Increase substitutions or add players.`,
    })
  }

  const keeperPositionTypeId = sportConfig.positionTypes.find((pt) => pt.isKeeper)?.id ?? null
  if (keeperPositionTypeId) {
    const keeperEligible = players.filter(
      (p) => !(p.excludedPositionTypeIds ?? []).includes(keeperPositionTypeId),
    )
    if (keeperEligible.length === 0) {
      warnings.push({
        kind: 'keeper-unavailable',
        message: 'No players are eligible for keeper. Assign keeper manually.',
      })
    }
  }

  const l1Count = players.filter((p) => normalizePlayerLevel(p.level) === 1).length
  if (l1Count > sportConfig.totalOnField + 1) {
    warnings.push({
      kind: 'l1-cap-infeasible',
      message: `${l1Count} protected (L1) players but only ${sportConfig.totalOnField} field slots — more than one will need to sit at once, exceeding the protected-player bench limit.`,
    })
  }

  const playerIds = new Set(players.map((p) => p.id))
  for (const [segIdxStr, pin] of Object.entries(pins)) {
    const segIdx = Number(segIdxStr)
    if (pin.gkId && !playerIds.has(pin.gkId)) {
      warnings.push({
        kind: 'lock-conflict',
        message: `Pin at segment ${segIdx} references missing keeper player.`,
      })
    }
    if (pin.gkId && keeperPositionTypeId) {
      const p = players.find((pl) => pl.id === pin.gkId)
      if (p && (p.excludedPositionTypeIds ?? []).includes(keeperPositionTypeId)) {
        warnings.push({
          kind: 'lock-conflict',
          message: `Pin at segment ${segIdx} assigns ${p.name} as keeper but they are excluded from that role.`,
        })
      }
    }
    if (pin.fieldIds && pin.benchIds) {
      const overlap = pin.fieldIds.filter((id) => pin.benchIds!.includes(id))
      if (overlap.length > 0) {
        warnings.push({
          kind: 'lock-conflict',
          message: `Pin at segment ${segIdx} places the same player on field and bench.`,
        })
      }
    }
    const absentCount = new Set([...(pin.absentIds ?? []), ...(pin.absentCreditedIds ?? [])]
      .filter((id) => playerIds.has(id))).size
    if (absentCount > 0) {
      const active = players.length - absentCount
      if (active < sportConfig.totalOnField) {
        warnings.push({
          kind: 'low-player-count',
          message: `Segment ${segIdx}: ${absentCount} absent leaves only ${active} player${active === 1 ? '' : 's'} for ${sportConfig.totalOnField} field slot${sportConfig.totalOnField === 1 ? '' : 's'}.`,
        })
      }
    }
  }

  return warnings
}
