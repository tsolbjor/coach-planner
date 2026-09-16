import type { SegmentPin, SportConfig, TimeSlot, Player } from '../types'

export interface SchedulerInput {
  sportConfig: SportConfig
  players: Player[]
  benchStintMinutes: number
  matchCount?: number
  /** segmentIndex → user override */
  pins?: Record<number, SegmentPin>
  /** Exact contiguous historical prefix; never regenerated. */
  lockedSlots?: TimeSlot[]
  /** Swap keeper with a benched player at the period midpoint */
  changeKeeperMidPeriod?: boolean
  /** Max consecutive segments a player can be on the bench (default 1). */
  maxBenchSegments?: number
  /** Minimum substitutions per segment boundary (default 0). */
  minSubsPerSegment?: number
  /** Maximum substitutions per segment boundary (default bench size). */
  maxSubsPerSegment?: number
}

export interface SchedulerOutput {
  slots: TimeSlot[]
  warnings: SchedulerWarning[]
}

export type SchedulerWarningKind =
  | 'low-player-count'
  | 'keeper-unavailable'
  | 'bench-rotation-impossible'
  | 'l1-cap-infeasible'
  | 'lock-conflict'
  | 'position-unavailable'
  | 'invalid-input'
  | 'substitution-limit'

export interface SchedulerWarning {
  kind: SchedulerWarningKind
  message: string
}

export interface Segment {
  segmentIndex: number
  matchIndex: number
  periodIndex: number
  startMinute: number
  endMinute: number
  /** False only at an extra keeper midpoint inside the substitution cadence. */
  regularSubstitution: boolean
  keeperBoundary: boolean
  /** Actual unsplit substitution interval, in minutes. */
  substitutionMinutes: number
}
