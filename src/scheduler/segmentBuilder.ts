import type { Segment } from './types'
import type { SportConfig } from '../types'

/**
 * Divides match time into evenly spaced segments.
 * subsPerPeriod=3 → 4 segments per period.
 * Period boundaries always start a new segment.
 */
export function buildSegments(sport: SportConfig, subsPerPeriod: number): Segment[] {
  const segmentsPerPeriod = subsPerPeriod + 1
  const segmentDuration = sport.periodDurationMinutes / segmentsPerPeriod
  const segments: Segment[] = []
  let segmentIndex = 0

  for (let p = 0; p < sport.periodCount; p++) {
    const periodStart = p * sport.periodDurationMinutes
    for (let s = 0; s < segmentsPerPeriod; s++) {
      const startMinute = periodStart + s * segmentDuration
      const endMinute = periodStart + (s + 1) * segmentDuration
      segments.push({
        segmentIndex: segmentIndex++,
        periodIndex: p,
        startMinute: Math.round(startMinute * 10) / 10,
        endMinute: Math.round(endMinute * 10) / 10,
      })
    }
  }

  return segments
}
