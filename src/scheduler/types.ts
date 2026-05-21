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

export type SchedulerWarningKind =
  | 'low-player-count'
  | 'keeper-unavailable'
  | 'bench-rotation-impossible'
  | 'l1-cap-infeasible'
  | 'lock-conflict'

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
}

