import type { Segment } from './types'
import type { SportConfig } from '../types'

/** Exact match-relative intervals. Midpoints never change the original bench cadence. */
export function buildSegments(
  sport: SportConfig,
  benchStintMinutes: number,
  matchCount = 1,
  changeKeeperMidPeriod = false,
): Segment[] {
  if (!Number.isFinite(benchStintMinutes) || benchStintMinutes <= 0 ||
      !Number.isFinite(sport.periodDurationMinutes) || sport.periodDurationMinutes <= 0 ||
      !Number.isSafeInteger(sport.periodCount) || sport.periodCount <= 0 ||
      !Number.isSafeInteger(matchCount) || matchCount <= 0) {
    throw new RangeError('Match count, period count and durations must be finite and positive; counts must be integers.')
  }
  const count = Math.max(1, Math.round(sport.periodDurationMinutes / benchStintMinutes))
  if (!Number.isSafeInteger(count) || (count + 1) * sport.periodCount * matchCount > 10000) {
    throw new RangeError('Schedule exceeds 10,000 intervals; increase the substitution interval.')
  }
  const duration = sport.periodDurationMinutes / count
  const segments: Segment[] = []
  for (let m = 0; m < matchCount; m++) {
    for (let p = 0; p < sport.periodCount; p++) {
      const start = p * sport.periodDurationMinutes
      const midpoint = sport.periodDurationMinutes / 2
      const boundaries = Array.from({ length: count + 1 }, (_, i) => i * duration)
      if (changeKeeperMidPeriod && count % 2 !== 0) boundaries.push(midpoint)
      boundaries.sort((a, b) => a - b)
      for (let i = 0; i < boundaries.length - 1; i++) {
        const relativeStart = boundaries[i]!
        segments.push({
          segmentIndex: segments.length,
          matchIndex: m,
          periodIndex: p,
          startMinute: start + relativeStart,
          endMinute: start + boundaries[i + 1]!,
          regularSubstitution: !(changeKeeperMidPeriod && count % 2 !== 0 && relativeStart === midpoint),
          keeperBoundary: changeKeeperMidPeriod && Math.abs(relativeStart - midpoint) < 1e-8,
          substitutionMinutes: duration,
        })
      }
    }
  }
  return segments
}
