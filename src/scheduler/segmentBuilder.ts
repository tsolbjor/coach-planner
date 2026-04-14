import type { Segment } from './types'
import type { SportConfig } from '../types'

/**
 * Divides match time into evenly spaced segments based on bench stint duration.
 * Generates segments for all matches in the plan; scores carry over between matches
 * so pitch time balances across the full set of games.
 * startMinute/endMinute are relative to each match start (not the full plan).
 */
export function buildSegments(sport: SportConfig, benchStintMinutes: number, matchCount = 1): Segment[] {
  const segmentsPerPeriod = Math.max(1, Math.round(sport.periodDurationMinutes / benchStintMinutes))
  const segmentDuration = sport.periodDurationMinutes / segmentsPerPeriod
  const segments: Segment[] = []
  let segmentIndex = 0

  for (let m = 0; m < matchCount; m++) {
    for (let p = 0; p < sport.periodCount; p++) {
      const periodStart = p * sport.periodDurationMinutes
      for (let s = 0; s < segmentsPerPeriod; s++) {
        const startMinute = periodStart + s * segmentDuration
        const endMinute = periodStart + (s + 1) * segmentDuration
        segments.push({
          segmentIndex: segmentIndex++,
          matchIndex: m,
          periodIndex: p,
          startMinute: Math.round(startMinute * 10) / 10,
          endMinute: Math.round(endMinute * 10) / 10,
        })
      }
    }
  }

  return segments
}
