import type { Player } from '../types'
import type { PlayerScore, SchedulerWarning } from './types'

/**
 * Determines which player fills the keeper slot for a given segment.
 * Returns the playerId or null (with a warning) if no eligible keeper exists.
 *
 * @param lastKeeperId - keeper from the previous segment (used to enforce minKeeperSegments)
 * @param minKeeperSegments - minimum consecutive segments before rotating the keeper
 */
export function assignKeeper(
  players: Player[],
  scores: Map<string, PlayerScore>,
  keeperPositionTypeId: string,
  lastKeeperId: string | null,
  minKeeperSegments: number,
  previousBenchIds: string[],
  requireBenchChange: boolean,
  warnings: SchedulerWarning[],
): string | null {
  // Enforce minimum keeper stint: if the last keeper hasn't served enough segments, keep them
  if (lastKeeperId && minKeeperSegments > 0) {
    const lastScore = scores.get(lastKeeperId)
    const lastKeeper = players.find((p) => p.id === lastKeeperId)
    if (lastKeeper && lastScore && lastScore.consecutiveKeeperSegments < minKeeperSegments) {
      return lastKeeperId
    }
  }

  const eligible = players.filter((player) => !player.excludedPositionTypeIds.includes(keeperPositionTypeId))
  if (eligible.length === 0) {
    warnings.push({ kind: 'keeper-unavailable', message: 'No players are eligible for keeper. Assign keeper manually.' })
    return null
  }

  const benchEligible = eligible.filter((player) => previousBenchIds.includes(player.id))
  if (requireBenchChange) {
    if (benchEligible.length === 0) {
      return lastKeeperId
    }
    return pickKeeper(benchEligible, scores)
  }

  return pickKeeper(eligible, scores)
}

function pickKeeper(
  eligible: Player[],
  scores: Map<string, PlayerScore>,
): string | null {
  // Pick the eligible player with fewest keeper minutes; break ties by most total pitch time (they need compensation)
  const sorted = [...eligible].sort((a, b) => {
    const sa = scores.get(a.id)!
    const sb = scores.get(b.id)!
    if (sa.keeperMinutes !== sb.keeperMinutes) return sa.keeperMinutes - sb.keeperMinutes
    return (sb.fieldMinutes + sb.keeperMinutes) - (sa.fieldMinutes + sa.keeperMinutes)
  })

  return sorted[0]!.id
}
