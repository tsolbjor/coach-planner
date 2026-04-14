import type { SportConfig } from './sport'
import type { Player } from './player'

/**
 * One time segment of a match.
 * assignments: LineupSlot.slotId → Player.id | null
 */
export interface TimeSlot {
  id: string
  /** 0-based index of the match this slot belongs to */
  matchIndex: number
  /** 0-based period within this match */
  periodIndex: number
  /** Minutes from the start of THIS match (not the whole plan) */
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
  /** Duration of each bench stint in minutes — determines substitution cadence */
  benchStintMinutes: number
  /** How many matches to generate in this plan (default 1) */
  matchCount: number
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
