import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import { normalizePlayerLevel, type SavedItem, type MatchPlan, type SegmentPin, type TournamentPlan, type Player } from '../types'
import { generatePlan } from '../scheduler'
import { buildSegments } from '../scheduler/segmentBuilder'
import { getSlotIntervals } from '../utils/slotIntervals'

function regenSlots(plan: MatchPlan): MatchPlan {
  const active = plan.roster.filter((p) => !plan.absentPlayerIds.includes(p.id))
  const hasHistory = !!plan.lockedSlots?.length
  const pins = { ...plan.pins }
  if (hasHistory && plan.absentPlayerIds.length) {
    const absentIds = plan.absentPlayerIds.filter((id) => plan.roster.some((p) => p.id === id))
    let intervalCount = 0
    try {
      intervalCount = buildSegments(
        plan.sportConfig, plan.benchStintMinutes, plan.matchCount, plan.changeKeeperMidPeriod,
      ).length
    } catch {
      // Invalid configuration is reported by generation while retaining history.
    }
    for (let index = plan.lockedSlots!.length; index < intervalCount; index++) {
      const pin = { ...pins[index] }
      const remaining = (ids: string[]) => ids.filter((id) => !absentIds.includes(id))
      const fields = remaining([...new Set([...(pin.fieldIds ?? []), ...(pin.requiredFieldIds ?? [])])])
      const bench = remaining([...new Set([...(pin.benchIds ?? []), ...(pin.requiredBenchIds ?? [])])])
      delete pin.fieldIds
      delete pin.benchIds
      if (pin.gkId && absentIds.includes(pin.gkId)) delete pin.gkId
      pin.requiredFieldIds = fields
      pin.requiredBenchIds = bench
      pin.absentIds = [...new Set([...(pin.absentIds ?? []), ...absentIds])]
      pin.absentCreditedIds = remaining(pin.absentCreditedIds ?? [])
      pins[index] = pin
    }
  }
  const result = generatePlan({
    sportConfig: plan.sportConfig,
    players: hasHistory ? plan.roster : active,
    benchStintMinutes: plan.benchStintMinutes,
    matchCount: plan.matchCount,
    pins,
    changeKeeperMidPeriod: plan.changeKeeperMidPeriod,
    maxBenchSegments: plan.maxBenchSegments,
    minSubsPerSegment: plan.minSubsPerSegment,
    maxSubsPerSegment: plan.maxSubsPerSegment,
    lockedSlots: plan.lockedSlots,
  })
  return {
    ...plan,
    pinSchemaVersion: 1,
    slots: result.slots,
    warnings: [...(plan.warnings ?? []).filter((w) => w.kind === 'pin-migration'), ...result.warnings],
  }
}

export function changesStructure(plan: MatchPlan, updates: Partial<MatchPlan>): boolean {
  const next = { ...plan, ...updates }
  const shape = (p: MatchPlan) => JSON.stringify({
    cadence: p.benchStintMinutes,
    matches: p.matchCount,
    midpoint: p.changeKeeperMidPeriod,
    periods: p.sportConfig.periodCount,
    duration: p.sportConfig.periodDurationMinutes,
    onField: p.sportConfig.totalOnField,
    keeper: p.sportConfig.hasKeeper,
    lineup: p.sportConfig.lineupSlots.map((s) => [s.slotId, s.positionTypeId]),
  })
  return shape(plan) !== shape(next)
}

function generationKey(plan: MatchPlan): string {
  return JSON.stringify({
    ...plan,
    id: undefined,
    name: undefined,
    createdAt: undefined,
    updatedAt: undefined,
    slots: undefined,
    warnings: undefined,
    roster: plan.roster.map(({ name: _name, ...player }) => player),
    sportConfig: {
      ...plan.sportConfig,
      name: undefined,
      presetId: undefined,
      positionTypes: plan.sportConfig.positionTypes.map(({ label: _label, shortLabel: _short, ...p }) => p),
      lineupSlots: plan.sportConfig.lineupSlots.map(({ label: _label, ...s }) => s),
    },
  })
}

function preserveLockedPins(plan: MatchPlan, pins: Record<number, SegmentPin>): Record<number, SegmentPin> {
  const lockedCount = plan.lockedSlots?.length ?? 0
  return {
    ...Object.fromEntries(Object.entries(pins).filter(([index]) => Number(index) >= lockedCount)),
    ...Object.fromEntries(Object.entries(plan.pins).filter(([index]) => Number(index) < lockedCount)),
  }
}

interface SavedPlansState {
  items: SavedItem[]
  currentMatchId: string | null
  /** Create a new match plan, persist it, and return it */
  createMatch: (base: Omit<MatchPlan, 'id' | 'createdAt' | 'updatedAt'>) => MatchPlan
  setCurrentMatch: (planId: string | null) => void
  /** Upsert a match plan by id */
  saveMatch: (plan: MatchPlan) => void
  saveTournament: (plan: TournamentPlan) => void
  deleteSaved: (id: string) => void
  getSaved: (id: string) => SavedItem | undefined
  /** Update top-level fields of a match plan */
  updateMatch: (planId: string, updates: Partial<Omit<MatchPlan, 'id' | 'createdAt'>>) => void
  /** Per-plan roster CRUD */
  addMatchPlayer: (planId: string, player: Omit<Player, 'id'>) => void
  updateMatchPlayer: (planId: string, playerId: string, updates: Partial<Omit<Player, 'id'>>) => void
  removeMatchPlayer: (planId: string, playerId: string) => void
  /** Pin / unpin a segment override */
  setSegmentPin: (planId: string, segmentIndex: number, pin: SegmentPin) => void
  /** Batch set/clear pins. Value `null` removes that pin. */
  setSegmentPins: (planId: string, updates: Record<number, SegmentPin | null>, lockBeforeIndex?: number) => void
  clearSegmentPin: (planId: string, segmentIndex: number) => void
  clearAllPins: (planId: string) => void
}

function savedId(item: SavedItem): string {
  return item.plan.id
}

function patchMatch(
  items: SavedItem[],
  planId: string,
  fn: (plan: MatchPlan) => MatchPlan,
): SavedItem[] {
  return items.map((item) => {
    if (item.kind !== 'match' || item.plan.id !== planId) return item
    const next = fn(item.plan)
    return { ...item, plan: generationKey(next) === generationKey(item.plan) ? next : regenSlots(next) }
  })
}

function normalizePlayer(player: Player): Player {
  return {
    ...player,
    level: normalizePlayerLevel(player.level),
  }
}

function normalizeMatchPlan(plan: MatchPlan): MatchPlan {
  const slotsOk = (plan.slots ?? []).every(
    (s) =>
      'gkId' in s &&
      Array.isArray((s as { fieldIds?: unknown }).fieldIds) &&
      Array.isArray((s as { absentIds?: unknown }).absentIds) &&
      Array.isArray((s as { absentCreditedIds?: unknown }).absentCreditedIds),
  )
  const benchSize = Math.max(0, plan.roster.length - plan.sportConfig.totalOnField)
  const normalized: MatchPlan = {
    ...plan,
    roster: plan.roster.map(normalizePlayer),
    pins: plan.pins ?? {},
    changeKeeperMidPeriod: plan.changeKeeperMidPeriod ?? false,
    maxBenchSegments: plan.maxBenchSegments ?? 1,
    minSubsPerSegment: plan.minSubsPerSegment ?? 0,
    maxSubsPerSegment: plan.maxSubsPerSegment ?? Math.max(1, benchSize),
    slots: slotsOk ? (plan.slots ?? []) : [],
    lockedSlots: plan.lockedSlots?.flatMap(getSlotIntervals),
  }
  // An empty generated schedule (for example, everyone absent) provides no
  // timing evidence. Versioned pins already use canonical interval indices.
  const canonicalPinsWithoutSlots = normalized.pinSchemaVersion === 1 && normalized.slots.length === 0
  if (Object.keys(normalized.pins).length && !canonicalPinsWithoutSlots) {
    let segments: ReturnType<typeof buildSegments> = []
    try {
      segments = buildSegments(normalized.sportConfig, normalized.benchStintMinutes, normalized.matchCount, normalized.changeKeeperMidPeriod)
    } catch {
      // Generation reports invalid configuration; overrides without safe timing
      // cannot be carried into a different interval.
    }
    const remapped: Record<number, SegmentPin> = {}
    let lostPin = false
    const timingTolerance = 1e-8
    for (const [index, pin] of Object.entries(normalized.pins)) {
      const old = normalized.slots[Number(index)]
      // Old saved schedules rounded endpoints to tenths of a minute. Prefer
      // exact timing, then allow that legacy rounding only for rounded inputs.
      const roundedLegacyTimes = old && [old.startMinute, old.endMinute].every(
        (minute) => Math.abs(minute * 10 - Math.round(minute * 10)) < timingTolerance,
      )
      const tolerances = roundedLegacyTimes ? [timingTolerance, 0.051] : [timingTolerance]
      const targets = old ? tolerances.map((tolerance) => {
        const matches = segments.filter((s) => s.matchIndex === old.matchIndex &&
          s.periodIndex === old.periodIndex && s.startMinute >= old.startMinute - tolerance &&
          s.endMinute <= old.endMinute + tolerance)
        return matches.length && Math.abs(matches[0]!.startMinute - old.startMinute) <= tolerance &&
          Math.abs(matches[matches.length - 1]!.endMinute - old.endMinute) <= tolerance ? matches : []
      }).find((matches) => matches.length) ?? [] : []
      if (!targets.length) {
        lostPin = true
        continue
      }
      for (const target of targets) remapped[target.segmentIndex] = pin
    }
    normalized.pins = remapped
    if (lostPin) normalized.warnings = [
      ...(normalized.warnings ?? []).filter((w) => w.kind !== 'pin-migration'),
      { kind: 'pin-migration', message: 'Some saved overrides could not be matched to the new interval timing and were cleared. Review the plan before use.' },
    ]
  }
  return regenSlots(normalized)
}

function normalizeTournamentPlan(plan: TournamentPlan): TournamentPlan {
  return {
    ...plan,
    roster: plan.roster.map(normalizePlayer),
    matches: plan.matches.map(normalizeMatchPlan),
  }
}

function normalizeSavedItem(item: SavedItem): SavedItem {
  return item.kind === 'match'
    ? { kind: 'match', plan: normalizeMatchPlan(item.plan) }
    : { kind: 'tournament', plan: normalizeTournamentPlan(item.plan) }
}

export const useSavedPlansStore = create<SavedPlansState>()(
  persist(
    (set, get) => ({
      items: [],
      currentMatchId: null,

      createMatch: (base) => {
        const plan = normalizeMatchPlan({
          ...base,
          id: nanoid(8),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        set((s) => ({ items: [...s.items, { kind: 'match', plan }], currentMatchId: plan.id }))
        return plan
      },

      setCurrentMatch: (planId) => set({ currentMatchId: planId }),

      saveMatch: (plan) =>
        set((s) => {
          const idx = s.items.findIndex((i) => i.kind === 'match' && i.plan.id === plan.id)
          const existing = s.items[idx]
          if (existing?.kind === 'match' && existing.plan.lockedSlots?.length) {
            if (changesStructure(existing.plan, plan) ||
              existing.plan.roster.some((p) => !plan.roster.some((next) => next.id === p.id))) return {}
            plan = {
              ...plan,
              lockedSlots: existing.plan.lockedSlots,
              pins: preserveLockedPins(existing.plan, plan.pins),
            }
          }
          const normalizedPlan = normalizeMatchPlan(plan)
          const item: SavedItem = { kind: 'match', plan: normalizedPlan }
          if (idx >= 0) {
            const items = [...s.items]
            items[idx] = item
            return { items }
          }
          return { items: [...s.items, item] }
        }),

      saveTournament: (plan) =>
        set((s) => {
          const normalizedPlan = normalizeTournamentPlan(plan)
          const idx = s.items.findIndex((i) => i.kind === 'tournament' && i.plan.id === plan.id)
          const item: SavedItem = { kind: 'tournament', plan: normalizedPlan }
          if (idx >= 0) {
            const items = [...s.items]
            items[idx] = item
            return { items }
          }
          return { items: [...s.items, item] }
        }),

      deleteSaved: (id) =>
        set((s) => ({
          items: s.items.filter((i) => savedId(i) !== id),
          currentMatchId: s.currentMatchId === id ? null : s.currentMatchId,
        })),

      getSaved: (id) => get().items.find((i) => savedId(i) === id),

      updateMatch: (planId, updates) =>
        set((s) => ({
          items: patchMatch(s.items, planId, (plan) => {
            if (plan.lockedSlots?.length && updates.roster &&
              plan.roster.some((p) => !updates.roster!.some((next) => next.id === p.id))) return plan
            if (changesStructure(plan, updates) && (
              (plan.lockedSlots?.length ?? 0) > 0 ||
              (Object.keys(plan.pins).length > 0 && (!updates.pins || Object.keys(updates.pins).length > 0))
            )) return plan
            return {
              ...plan,
              ...updates,
              slots: plan.slots,
              warnings: plan.warnings,
              lockedSlots: plan.lockedSlots,
              pins: preserveLockedPins(plan, updates.pins ?? plan.pins),
              roster: (updates.roster ?? plan.roster).map(normalizePlayer),
              updatedAt: new Date().toISOString(),
            }
          }),
        })),

      addMatchPlayer: (planId, player) =>
        set((s) => ({
          items: patchMatch(s.items, planId, (plan) => ({
            ...plan,
            roster: [...plan.roster, normalizePlayer({ ...player, id: nanoid(8) })],
            updatedAt: new Date().toISOString(),
          })),
        })),

      updateMatchPlayer: (planId, playerId, updates) =>
        set((s) => ({
          items: patchMatch(s.items, planId, (plan) => ({
            ...plan,
            roster: plan.roster.map((p) => (p.id === playerId ? normalizePlayer({ ...p, ...updates }) : p)),
            updatedAt: new Date().toISOString(),
          })),
        })),

      removeMatchPlayer: (planId, playerId) =>
        set((s) => ({
          items: patchMatch(s.items, planId, (plan) => plan.lockedSlots?.length ? plan : ({
            ...plan,
            roster: plan.roster.filter((p) => p.id !== playerId),
            absentPlayerIds: plan.absentPlayerIds.filter((id) => id !== playerId),
            updatedAt: new Date().toISOString(),
          })),
        })),

      setSegmentPin: (planId, segmentIndex, pin) =>
        get().setSegmentPins(planId, { [segmentIndex]: pin }),

      setSegmentPins: (planId, updates, lockBeforeIndex) =>
        set((s) => ({
          items: patchMatch(s.items, planId, (plan) => {
            const next = { ...plan.pins }
            const lockedCount = plan.lockedSlots?.length ?? 0
            if (lockBeforeIndex !== undefined && (
              !Number.isInteger(lockBeforeIndex) || lockBeforeIndex < lockedCount ||
              lockBeforeIndex >= plan.slots.length
            )) return plan
            const prefixLength = Math.max(lockedCount, lockBeforeIndex ?? 0)
            let changed = false
            for (const [k, v] of Object.entries(updates)) {
              const idx = Number(k)
              if (!Number.isInteger(idx) || idx < prefixLength || idx >= plan.slots.length) continue
              if (v === null) delete next[idx]
              else next[idx] = v
              changed = true
            }
            if (!changed) return plan
            return {
              ...plan,
              pins: next,
              lockedSlots: prefixLength ? plan.slots.slice(0, prefixLength) : plan.lockedSlots,
              updatedAt: new Date().toISOString(),
            }
          }),
        })),

      clearSegmentPin: (planId, segmentIndex) =>
        get().setSegmentPins(planId, { [segmentIndex]: null }),

      clearAllPins: (planId) =>
        set((s) => ({
          items: patchMatch(s.items, planId, (plan) => ({
            ...plan,
            pins: Object.fromEntries(Object.entries(plan.pins).filter(([index]) => Number(index) < (plan.lockedSlots?.length ?? 0))),
            updatedAt: new Date().toISOString(),
          })),
        })),
    }),
    {
      name: 'coach-saved-plans',
      merge: (persistedState, currentState) => {
        const persisted = (persistedState as Partial<SavedPlansState> | undefined) ?? {}
        return {
          ...currentState,
          ...persisted,
          items: Array.isArray(persisted.items)
            ? persisted.items.map(normalizeSavedItem)
            : currentState.items,
        }
      },
    },
  ),
)
