import type { SportConfig, TimeSlot, Player, KeeperMode } from '../types'

export interface SchedulerInput {
  sportConfig: SportConfig
  players: Player[]
  subsPerPeriod: number
  keeperMode: KeeperMode
  existingSlots?: TimeSlot[]
}

export interface SchedulerOutput {
  slots: TimeSlot[]
  warnings: SchedulerWarning[]
}

export interface SchedulerWarning {
  kind: 'low-player-count' | 'keeper-unavailable' | 'no-fixed-keeper'
  message: string
}

export interface Segment {
  segmentIndex: number
  periodIndex: number
  startMinute: number
  endMinute: number
}

export interface PlayerScore {
  playerId: string
  fieldMinutes: number
  keeperSegments: number
  consecutiveBench: number
  recentSlotIds: string[]
}
