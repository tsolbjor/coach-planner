import type { SportConfig } from './sport'
import type { Player } from './player'

/**
 * One time segment of a match. Rotation is the core concept:
 *   gkId / fieldIds / benchIds drive who is in play.
 *   positions is a derived overlay mapping slotId → playerId for display only.
 */
export interface TimeSlot {
  id: string
  matchIndex: number
  periodIndex: number
  startMinute: number
  endMinute: number
  gkId: string | null
  /** Outfield player ids (excludes gk) */
  fieldIds: string[]
  benchIds: string[]
  /** Player ids absent (not in rotation) for this segment */
  absentIds: string[]
  /** Absent ids whose pitch-time still counts for fairness */
  absentCreditedIds: string[]
  /** Derived overlay: lineup slotId → playerId. Populated by position pass. */
  positions: Record<string, string | null>
  /**
   * If set, a keeper swap happens inside this segment at `atMinute`. The
   * segment's main fields (gkId / fieldIds / benchIds / positions) describe the
   * state AFTER the swap; pre.* describes the state BEFORE.
   */
  midSwap?: {
    atMinute: number
    preGkId: string | null
    preFieldIds: string[]
    preBenchIds: string[]
    prePositions: Record<string, string | null>
  }
}

/**
 * User overrides at a given segment. Solver fills unpinned segments fresh;
 * pinned segments use these exact values and naturally propagate forward
 * because subsequent segments derive from the prior state + fairness.
 */
export interface SegmentPin {
  /** Override the keeper for this segment */
  gkId?: string | null
  /** Exact field player ids (outfield) — if set, locks the field composition */
  fieldIds?: string[]
  /** Exact bench player ids — if set, locks the bench composition */
  benchIds?: string[]
  /** Player ids absent for this segment — excluded from rotation; no pitch-time credit */
  absentIds?: string[]
  /** Absent ids that still receive pitch-time credit for fairness (e.g. mid-game injury) */
  absentCreditedIds?: string[]
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
  /** segmentIndex → user override. Solver respects these and auto-fills the rest. */
  pins: Record<number, SegmentPin>
  /** When true, swap keeper with a benched player at the period midpoint */
  changeKeeperMidPeriod: boolean
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
