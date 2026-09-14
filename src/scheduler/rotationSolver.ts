import { normalizePlayerLevel, type Player, type SegmentPin, type SportConfig, type TimeSlot } from '../types'
import type { Segment, SchedulerWarning } from './types'
import { canPlayPosition, maxMatch } from './maxMatch'

export interface RotationSolverInput {
  sportConfig: SportConfig
  players: Player[]
  segments: Segment[]
  pins: Record<number, SegmentPin>
  lockedSlots?: TimeSlot[]
  changeKeeperMidPeriod?: boolean
  maxBenchSegments?: number
  minSubsPerSegment?: number
  maxSubsPerSegment?: number
}

export interface RotationSolverResult {
  gkBySegment: (string | null)[]
  benchBySegment: string[][]
  fieldBySegment: string[][]
  warnings: SchedulerWarning[]
}

interface Stats {
  pitch: number
  keeper: number
  playingStreak: number
  benchStreak: number
}

interface Constraints {
  gkId?: string | null
  fieldIds?: string[]
  benchIds?: string[]
  requiredFieldIds: string[]
  requiredBenchIds: string[]
}

interface Lineup {
  gkId: string | null
  fieldIds: string[]
  benchIds: string[]
}

const EPSILON = 1e-8
const compare = (a: number[], b: number[]) => {
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i]! - b[i]!) > EPSILON) return a[i]! - b[i]!
  }
  return 0
}

/**
 * Deterministic, matching-backed rotation, not a global optimizer.
 * Priority: maximum eligible coverage; compatible explicit pins; continuous
 * rest caps / return after period boundaries; keeper cadence and minute fairness;
 * feasible substitution/L1 guardrails; protect recent returners, longest playing
 * streak then total pitch-minute fairness. IDs break remaining ties.
 * Midpoint-only boundaries prefer the keeper exchange, not a whole bench change.
 * Every soft-rule relaxation is checked on the final selected interval.
 */
export function solveRotation(input: RotationSolverInput): RotationSolverResult {
  const { sportConfig: sport, players, segments, pins, lockedSlots = [],
    maxBenchSegments = 1, minSubsPerSegment = 0,
    maxSubsPerSegment = Number.POSITIVE_INFINITY } = input
  const warnings: SchedulerWarning[] = []
  const result: RotationSolverResult = {
    gkBySegment: [], benchBySegment: [], fieldBySegment: [], warnings,
  }
  const keeperSlot = sport.lineupSlots.find((s) =>
    sport.positionTypes.find((p) => p.id === s.positionTypeId)?.isKeeper)
  const fieldSlots = sport.lineupSlots.filter((s) => s !== keeperSlot)
  const byId = new Map(players.map((p) => [p.id, p]))
  const stats = new Map(players.map((p) => [p.id, { pitch: 0, keeper: 0, playingStreak: 0, benchStreak: 0 }]))
  const get = (id: string): Stats => stats.get(id)!
  let previous: Lineup | undefined
  let previousSegment: Segment | undefined

  for (const seg of segments) {
    const duration = seg.endMinute - seg.startMinute
    const newMatch = !previousSegment || seg.matchIndex !== previousSegment.matchIndex
    const newPeriod = newMatch || seg.periodIndex !== previousSegment?.periodIndex
    if (newMatch) {
      for (const s of stats.values()) { s.benchStreak = 0; s.playingStreak = 0 }
    }
    const label = `Match ${seg.matchIndex + 1}, period ${seg.periodIndex + 1}, segment ${seg.segmentIndex + 1} (${seg.startMinute}–${seg.endMinute} min)`
    const warn = (kind: SchedulerWarning['kind'], message: string) =>
      warnings.push({ kind, message: `${label}: ${message}` })
    const pin = pins[seg.segmentIndex] ?? {}
    const absent = new Set([...(pin.absentIds ?? []), ...(pin.absentCreditedIds ?? [])])
    const active = players.filter((p) => !absent.has(p.id))
    const activeIds = new Set(active.map((p) => p.id))
    const oldBench = new Set(previous?.benchIds ?? [])
    const cap = seg.substitutionMinutes * maxBenchSegments
    const requiredReturn = active.filter((p) =>
      get(p.id).benchStreak + duration > cap + EPSILON && oldBench.has(p.id))
    const regular = seg.regularSubstitution
    const targetSubs = previous && !newMatch && regular
      ? Math.max(Math.min(maxSubsPerSegment, Math.max(minSubsPerSegment, oldBench.size ? 1 : 0)), requiredReturn.length)
      : 0
    const keepers = keeperSlot
      ? active.filter((p) => canPlayPosition(p, keeperSlot.positionTypeId)).map((p) => p.id)
      : []
    const keeperCandidates: (string | null)[] = [...keepers, null]
    const empty: Constraints = { requiredFieldIds: [], requiredBenchIds: [] }

    // Required players form an independent set in the position-matching matroid.
    // Extending that set one player at a time guarantees coverage without ever
    // discarding a required player in favour of a merely preferred one.
    const initialLineup = (gkId: string | null, c: Constraints): Lineup | null => {
      if (c.gkId !== undefined && c.gkId !== gkId) return null
      if (gkId && (c.requiredFieldIds.includes(gkId) || c.requiredBenchIds.includes(gkId) ||
        c.fieldIds?.includes(gkId) || c.benchIds?.includes(gkId))) return null
      const forbidden = new Set([...(c.benchIds ?? []), ...c.requiredBenchIds])
      const required = new Set([...c.requiredFieldIds, ...(c.fieldIds ?? []),
        ...(c.benchIds ? active.filter((p) => p.id !== gkId && !c.benchIds!.includes(p.id)).map((p) => p.id) : [])])
      if ([...required].some((id) => !activeIds.has(id) || forbidden.has(id) || id === gkId)) return null
      let field = active.filter((p) => required.has(p.id))
      if (maxMatch(fieldSlots, field, canPlayPosition).size !== field.length) return null
      const pool = active.filter((p) => p.id !== gkId && !forbidden.has(p.id) &&
        !required.has(p.id) && (!c.fieldIds || c.fieldIds.includes(p.id)))
      pool.sort((a, b) =>
        Number(oldBench.has(b.id)) - Number(oldBench.has(a.id)) ||
        get(a.id).playingStreak - get(b.id).playingStreak ||
        get(a.id).pitch - get(b.id).pitch || a.id.localeCompare(b.id))
      for (const p of pool) {
        if (field.length >= fieldSlots.length) break
        const trial = [...field, p]
        if (maxMatch(fieldSlots, trial, canPlayPosition).size === trial.length) field = trial
      }
      const fieldIds = field.map((p) => p.id)
      const benchIds = active.filter((p) => p.id !== gkId && !fieldIds.includes(p.id)).map((p) => p.id)
      if (c.requiredBenchIds.some((id) => !benchIds.includes(id)) ||
        (c.benchIds && !sameIds(benchIds, c.benchIds))) return null
      return { gkId, fieldIds, benchIds }
    }
    const coverage = (lineup: Lineup) => lineup.fieldIds.length + Number(!!lineup.gkId)
    const candidatesFor = (c: Constraints) => keeperCandidates
      .map((id) => initialLineup(id, c)).filter((x): x is Lineup => !!x)
    const unconstrained = candidatesFor(empty)
    const bestCoverage = Math.max(0, ...unconstrained.map(coverage))
    let constraints = empty
    const nextSegment = segments[seg.segmentIndex + 1]
    const followingSegment = segments[seg.segmentIndex + 2]
    const preparingMidpoint = nextSegment?.keeperBoundary ? nextSegment
      : followingSegment?.keeperBoundary && followingSegment.matchIndex === seg.matchIndex &&
        followingSegment.periodIndex === seg.periodIndex ? followingSegment : undefined
    const nextPin = preparingMidpoint ? pins[preparingMidpoint.segmentIndex] ?? {} : {}
    const nextAbsent = new Set([...(nextPin.absentIds ?? []), ...(nextPin.absentCreditedIds ?? [])])
    const nextActive = players.filter((p) => !nextAbsent.has(p.id))
    const nextKeeperCandidates = preparingMidpoint && keeperSlot
      ? nextActive.filter((p) => canPlayPosition(p, keeperSlot.positionTypeId) &&
        (nextPin.gkId === undefined || nextPin.gkId === p.id) &&
        !(nextPin.fieldIds ?? []).includes(p.id) && !(nextPin.requiredFieldIds ?? []).includes(p.id) &&
        !(nextPin.benchIds ?? []).includes(p.id) && !(nextPin.requiredBenchIds ?? []).includes(p.id) &&
        maxMatch(fieldSlots, nextActive.filter((other) => other.id !== p.id), canPlayPosition).size === fieldSlots.length)
      : []
    const accept = (next: Constraints, description: string) => {
      if (candidatesFor(next).some((candidate) => coverage(candidate) === bestCoverage)) constraints = next
      else warn('lock-conflict', `${description} rejected: incompatible with eligibility, full available coverage or another pin.`)
    }

    const locked = lockedSlots[seg.segmentIndex]
    if (!locked) {
      for (const id of absent) {
        if (!byId.has(id)) warn('lock-conflict', `Absent pin references missing player ${id}.`)
      }
      if (pin.gkId !== undefined) {
        if (pin.gkId && (!keepers.includes(pin.gkId) || !activeIds.has(pin.gkId))) {
          warn('lock-conflict', `Keeper pin ${pin.gkId} rejected: player is missing, absent or ineligible.`)
        } else accept({ ...constraints, gkId: pin.gkId }, 'Keeper pin')
      }
      for (const key of ['fieldIds', 'benchIds'] as const) {
        const ids = pin[key]
        if (ids === undefined) continue
        if (new Set(ids).size !== ids.length || ids.some((id) => !activeIds.has(id))) {
          warn('lock-conflict', `${key} exact pin rejected: duplicate, missing or absent player.`)
        } else accept({ ...constraints, [key]: ids }, `${key} exact pin`)
      }
      for (const key of ['requiredFieldIds', 'requiredBenchIds'] as const) {
        for (const id of [...new Set(pin[key] ?? [])].sort()) {
          if (!activeIds.has(id)) warn('lock-conflict', `${key} pin ${id} rejected: missing or absent player.`)
          else accept({ ...constraints, [key]: [...constraints[key], id] }, `${key} pin ${id}`)
        }
      }
    }

    const score = (lineup: Lineup): number[] => {
      const bench = lineup.benchIds
      const newlyBenched = bench.filter((id) => !oldBench.has(id))
      const incoming = previous?.benchIds.filter((id) => activeIds.has(id) && !bench.includes(id)) ?? []
      const substitutions = Math.max(newlyBenched.length, incoming.length)
      const capOver = bench.reduce((sum, id) => sum + Math.max(0, get(id).benchStreak + duration - cap), 0)
      const boundaryRest = newPeriod && previous ? bench.filter((id) => oldBench.has(id)).length : 0
      const keeperChanged = lineup.gkId !== previous?.gkId
      const keeperCadence = keeperSlot && previous && !newPeriod
        ? seg.keeperBoundary ? Number(!keeperChanged) : Number(keeperChanged)
        : 0
      const keeperFromBench = seg.keeperBoundary && previous && keeperChanged && oldBench.size
        ? Number(!lineup.gkId || !oldBench.has(lineup.gkId)) : 0
      const keeperTime = (newPeriod || seg.keeperBoundary) && lineup.gkId ? get(lineup.gkId).keeper : 0
      const keeperPitch = (newPeriod || seg.keeperBoundary) && lineup.gkId ? get(lineup.gkId).pitch : 0
      const possibleNext = nextKeeperCandidates.filter((p) => p.id !== lineup.gkId)
      const nextOnBench = possibleNext.filter((p) =>
        nextSegment?.keeperBoundary ? bench.includes(p.id) : lineup.fieldIds.includes(p.id))
      const preparation = possibleNext.length && bench.length
        ? nextOnBench.length ? Math.min(...nextOnBench.map((p) => get(p.id).keeper))
          : 1e12
        : 0
      const exchangeExtra = !regular && previous
        ? bench.filter((id) => !oldBench.has(id) && id !== previous!.gkId).length +
          [...oldBench].filter((id) => activeIds.has(id) && !bench.includes(id) && id !== lineup.gkId).length
        : 0
      const outgoingRest = !newPeriod && keeperChanged && previous?.gkId && activeIds.has(previous.gkId) && bench.length
        ? Number(!bench.includes(previous.gkId)) : 0
      const churn = previous && !newMatch && regular
        ? Math.max(0, substitutions - maxSubsPerSegment) + Math.max(0, minSubsPerSegment - substitutions) : 0
      const l1 = Math.max(0, bench.filter((id) => normalizePlayerLevel(byId.get(id)!.level) === 1).length - 1)
      const target = previous && !newMatch && regular ? Math.abs(substitutions - targetSubs) : 0
      const recent = newlyBenched.filter((id) => get(id).playingStreak > 0 &&
        get(id).playingStreak <= seg.substitutionMinutes + EPSILON).length
      const streak = newlyBenched.reduce((sum, id) => sum - get(id).playingStreak, 0)
      const pitch = active.reduce((sum, p) => {
        const future = get(p.id).pitch + (bench.includes(p.id) ? 0 : duration)
        return sum + future * future
      }, 0)
      return [capOver, boundaryRest, keeperCadence, keeperFromBench, keeperTime, exchangeExtra,
        keeperPitch, preparation,
        outgoingRest, churn, l1, target, recent, streak, pitch,
        Number(newPeriod && lineup.gkId === previous?.gkId)]
    }

    let chosen: Lineup
    if (locked) {
      chosen = locked
    } else {
      let best: Lineup | undefined
      for (let candidate of candidatesFor(constraints).filter((c) => coverage(c) === bestCoverage)) {
        // One-for-one exchanges preserve composition and use maximum matching
        // as the eligibility oracle. Strict improvements guarantee termination.
        let improved = true
        while (improved) {
          improved = false
          let next = candidate
          let nextScore = score(candidate)
          for (const off of candidate.fieldIds) {
            if (constraints.fieldIds || constraints.benchIds || constraints.requiredFieldIds.includes(off)) continue
            for (const on of candidate.benchIds) {
              if (constraints.requiredBenchIds.includes(on)) continue
              const fieldIds = candidate.fieldIds.map((id) => id === off ? on : id)
              if (maxMatch(fieldSlots, fieldIds.map((id) => byId.get(id)!), canPlayPosition).size !== fieldIds.length) continue
              const trial = { ...candidate, fieldIds, benchIds: candidate.benchIds.map((id) => id === on ? off : id) }
              const trialScore = score(trial)
              if (compare(trialScore, nextScore) < 0) { next = trial; nextScore = trialScore; improved = true }
            }
          }
          candidate = next
        }
        if (!best || compare(score(candidate), score(best)) < 0) best = candidate
      }
      chosen = best ?? { gkId: null, fieldIds: [], benchIds: active.map((p) => p.id) }
      // Canonical membership ordering, preserving legacy exact composition order.
      chosen.fieldIds = constraints.fieldIds ? [...constraints.fieldIds] : [...chosen.fieldIds].sort()
      chosen.benchIds = constraints.benchIds ? [...constraints.benchIds] : [...chosen.benchIds].sort()
    }

    // Final interval validator: diagnostics describe actual output, including
    // overrides and historical play, rather than only attempted repairs.
    const currentActive = locked ? players.filter((p) => !locked.absentIds.includes(p.id)) : active
    const bench = new Set(chosen.benchIds)
    if (coverage(chosen) < sport.totalOnField) warn('position-unavailable',
      `${sport.totalOnField - coverage(chosen)} lineup position(s) unfilled; no eligible full lineup under the accepted constraints.`)
    if (currentActive.length < sport.totalOnField) warn('low-player-count', `Only ${currentActive.length} active players.`)
    if (keeperSlot && !chosen.gkId) warn('keeper-unavailable', 'No eligible keeper could be assigned.')
    for (const id of chosen.benchIds) {
      if (stats.has(id) && get(id).benchStreak + duration > cap + EPSILON) warn('bench-rotation-impossible',
        `${id} continuous bench time ${get(id).benchStreak + duration} min exceeds the ${cap} min cap.`)
      if (newPeriod && previous && oldBench.has(id)) warn('bench-rotation-impossible',
        `${id} could not return from bench at the period/match boundary.`)
    }
    const subs = previous ? Math.max(
      chosen.benchIds.filter((id) => !oldBench.has(id)).length,
      previous.benchIds.filter((id) => currentActive.some((p) => p.id === id) && !bench.has(id)).length,
    ) : 0
    if (previous && !newMatch && regular && (subs < minSubsPerSegment || subs > maxSubsPerSegment)) {
      warn('substitution-limit', `${subs} substitutions; requested range ${minSubsPerSegment}–${maxSubsPerSegment}. Eligibility, pins and rest take priority.`)
    }
    if (chosen.benchIds.filter((id) => normalizePlayerLevel(byId.get(id)?.level) === 1).length > 1) {
      warn('l1-cap-infeasible', 'More than one top-level player is on the bench.')
    }
    if (seg.keeperBoundary && keeperSlot && previous) {
      if (chosen.gkId === previous.gkId) warn('keeper-unavailable', 'Keeper mid-period swap skipped: no compatible alternative under higher-priority constraints.')
      else if (!chosen.gkId || !oldBench.has(chosen.gkId)) warn('bench-rotation-impossible',
        'Incoming midpoint keeper was not on the prior bench; eligibility or pins required a different exchange.')
      if (!regular && score(chosen)[5]! > 0) warn('substitution-limit',
        'Extra bench changes at the keeper-only midpoint were necessary for eligibility, pins or rest.')
    }
    result.gkBySegment[seg.segmentIndex] = chosen.gkId
    result.fieldBySegment[seg.segmentIndex] = [...chosen.fieldIds]
    result.benchBySegment[seg.segmentIndex] = [...chosen.benchIds]

    const credit = (lineup: Lineup, minutes: number, credited: string[]) => {
      for (const p of players) {
        const s = get(p.id)
        const on = lineup.gkId === p.id || lineup.fieldIds.includes(p.id)
        if (on || credited.includes(p.id)) s.pitch += minutes
        if (lineup.gkId === p.id) s.keeper += minutes
        s.playingStreak = on ? s.playingStreak + minutes : 0
        s.benchStreak = lineup.benchIds.includes(p.id) ? s.benchStreak + minutes : 0
      }
    }
    const credited = locked?.absentCreditedIds ?? pin.absentCreditedIds ?? []
    if (locked?.midSwap) {
      const swap = locked.midSwap
      credit({ gkId: swap.preGkId, fieldIds: swap.preFieldIds, benchIds: swap.preBenchIds },
        swap.atMinute - locked.startMinute, credited)
      credit(chosen, locked.endMinute - swap.atMinute, credited)
    } else credit(chosen, duration, credited)
    previous = chosen
    previousSegment = seg
  }
  return result
}

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id))
}
