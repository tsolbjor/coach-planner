import type { SportConfig, TimeSlot, Player } from '../types'

export interface SchedulerInput {
  sportConfig: SportConfig
  players: Player[]
  benchStintMinutes: number
  matchCount?: number
  existingSlots?: TimeSlot[]
}

export interface SchedulerOutput {
  slots: TimeSlot[]
  warnings: SchedulerWarning[]
}

export interface SchedulerWarning {
  kind: 'low-player-count' | 'keeper-unavailable' | 'bench-rotation-impossible'
  message: string
}

export interface Segment {
  segmentIndex: number
  matchIndex: number
  periodIndex: number
  startMinute: number
  endMinute: number
}

export interface PlayerScore {
  playerId: string
  /** Minutes played in outfield positions */
  fieldMinutes: number
  /** Minutes played as goalkeeper */
  keeperMinutes: number
  /** Consecutive segments currently on bench (resets when player takes the field) */
  consecutiveBench: number
  /** Consecutive segments currently on the field (resets when player goes to bench) */
  consecutiveFieldSegments: number
  /** Total segments spent on bench across the match */
  benchSegments: number
  /** Consecutive segments as keeper */
  consecutiveKeeperSegments: number
  /**
   * The segmentIndex of the last time this player was benched (-1 = never).
   * Used as a FIFO tiebreaker: whoever was benched longest ago is benched again first.
   */
  lastBenchedSegment: number
}
