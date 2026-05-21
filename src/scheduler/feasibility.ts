import { normalizePlayerLevel, type Player, type SportConfig, type TimeSlot } from '../types'
import type { SchedulerWarning } from './types'

export interface FeasibilityInput {
  sportConfig: SportConfig
  players: Player[]
  benchStintMinutes: number
  matchCount: number
  existingSlots: TimeSlot[]
}

export function checkFeasibility(input: FeasibilityInput): SchedulerWarning[] {
  const { sportConfig, players, benchStintMinutes, matchCount, existingSlots } = input
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
      message: `${l1Count} top-level players but only ${sportConfig.totalOnField} field slots — more than one will need to sit at once, violating the L1-on-bench cap.`,
    })
  }

  for (const lock of existingSlots) {
    if (!lock.locked) continue
    const seen = new Set<string>()
    for (const [slotId, playerId] of Object.entries(lock.assignments)) {
      if (!playerId) continue
      if (seen.has(playerId)) {
        warnings.push({
          kind: 'lock-conflict',
          message: `Locked slot at match ${lock.matchIndex + 1} period ${lock.periodIndex + 1} assigns the same player to two positions.`,
        })
      }
      seen.add(playerId)
      const player = players.find((p) => p.id === playerId)
      if (!player) continue
      const lineupSlot = sportConfig.lineupSlots.find((s) => s.slotId === slotId)
      if (!lineupSlot) continue
      if ((player.excludedPositionTypeIds ?? []).includes(lineupSlot.positionTypeId)) {
        warnings.push({
          kind: 'lock-conflict',
          message: `Locked slot at match ${lock.matchIndex + 1} period ${lock.periodIndex + 1} assigns ${player.name} to a position they are excluded from (${lineupSlot.label}).`,
        })
      }
      if (lock.bench.includes(playerId)) {
        warnings.push({
          kind: 'lock-conflict',
          message: `Locked slot at match ${lock.matchIndex + 1} period ${lock.periodIndex + 1} has ${player.name} on field and bench simultaneously.`,
        })
      }
    }
  }

  return warnings
}
