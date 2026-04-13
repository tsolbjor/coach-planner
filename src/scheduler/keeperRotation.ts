import type { Player } from '../types'
import type { PlayerScore, SchedulerWarning } from './types'

/**
 * Determines which player fills the keeper slot for a given segment.
 * Returns the playerId or null (with a warning) if no eligible keeper exists.
 */
export function assignKeeper(
  players: Player[],
  scores: Map<string, PlayerScore>,
  keeperMode: 'fixed' | 'rotating',
  warnings: SchedulerWarning[],
): string | null {
  if (keeperMode === 'fixed') {
    const fixed = players.find((p) => p.isFixedKeeper)
    if (!fixed) {
      warnings.push({ kind: 'no-fixed-keeper', message: 'No player is marked as fixed keeper — falling back to rotating.' })
      return assignRotatingKeeper(players, scores, warnings)
    }
    return fixed.id
  }
  return assignRotatingKeeper(players, scores, warnings)
}

function assignRotatingKeeper(
  players: Player[],
  scores: Map<string, PlayerScore>,
  warnings: SchedulerWarning[],
): string | null {
  const eligible = players.filter((p) => p.canBeKeeper || p.isFixedKeeper)
  if (eligible.length === 0) {
    warnings.push({ kind: 'keeper-unavailable', message: 'No players are eligible for keeper. Assign keeper manually.' })
    return null
  }

  // Pick the eligible player with fewest keeper segments; break ties by most field minutes (compensate)
  const sorted = [...eligible].sort((a, b) => {
    const sa = scores.get(a.id)!
    const sb = scores.get(b.id)!
    if (sa.keeperSegments !== sb.keeperSegments) return sa.keeperSegments - sb.keeperSegments
    return sb.fieldMinutes - sa.fieldMinutes
  })

  return sorted[0]!.id
}
