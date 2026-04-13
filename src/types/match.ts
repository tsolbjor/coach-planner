import type { SportConfig } from './sport'
import type { Player } from './player'

export type KeeperMode = 'fixed' | 'rotating'

/**
 * One time segment of a match.
 * assignments: LineupSlot.slotId → Player.id | null
 */
export interface TimeSlot {
  id: string
  periodIndex: number
  startMinute: number
  endMinute: number
  /** slotId → playerId */
  assignments: Record<string, string | null>
  bench: string[]
  /** If true, this slot was manually edited and won't be overwritten by regeneration */
  locked: boolean
}

export interface MatchPlan {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  sportConfig: SportConfig
  roster: Player[]
  /** How many substitutions per period (produces subsPerPeriod+1 segments per period) */
  subsPerPeriod: number
  keeperMode: KeeperMode
  slots: TimeSlot[]
  /** Player.id[] absent from this match */
  absentPlayerIds: string[]
}

export interface TournamentPlan {
  id: string
  name: string
  createdAt: string
  /** Shared roster across all matches */
  roster: Player[]
  sportConfig: SportConfig
  matches: MatchPlan[]
}

export type SavedItem =
  | { kind: 'match'; plan: MatchPlan }
  | { kind: 'tournament'; plan: TournamentPlan }
