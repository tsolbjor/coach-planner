import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type { SavedItem, MatchPlan, TournamentPlan, Player, TimeSlot } from '../types'

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
  /** Per-plan slot update */
  updateMatchSlot: (planId: string, slotId: string, updates: Partial<TimeSlot>) => void
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
    return { ...item, plan: fn(item.plan) }
  })
}

export const useSavedPlansStore = create<SavedPlansState>()(
  persist(
    (set, get) => ({
      items: [],
      currentMatchId: null,

      createMatch: (base) => {
        const plan: MatchPlan = {
          ...base,
          id: nanoid(8),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        set((s) => ({ items: [...s.items, { kind: 'match', plan }], currentMatchId: plan.id }))
        return plan
      },

      setCurrentMatch: (planId) => set({ currentMatchId: planId }),

      saveMatch: (plan) =>
        set((s) => {
          const idx = s.items.findIndex((i) => i.kind === 'match' && i.plan.id === plan.id)
          const item: SavedItem = { kind: 'match', plan }
          if (idx >= 0) {
            const items = [...s.items]
            items[idx] = item
            return { items }
          }
          return { items: [...s.items, item] }
        }),

      saveTournament: (plan) =>
        set((s) => {
          const idx = s.items.findIndex((i) => i.kind === 'tournament' && i.plan.id === plan.id)
          const item: SavedItem = { kind: 'tournament', plan }
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
          items: patchMatch(s.items, planId, (plan) => ({
            ...plan,
            ...updates,
            updatedAt: new Date().toISOString(),
          })),
        })),

      addMatchPlayer: (planId, player) =>
        set((s) => ({
          items: patchMatch(s.items, planId, (plan) => ({
            ...plan,
            roster: [...plan.roster, { ...player, id: nanoid(8) }],
            updatedAt: new Date().toISOString(),
          })),
        })),

      updateMatchPlayer: (planId, playerId, updates) =>
        set((s) => ({
          items: patchMatch(s.items, planId, (plan) => ({
            ...plan,
            roster: plan.roster.map((p) => (p.id === playerId ? { ...p, ...updates } : p)),
            updatedAt: new Date().toISOString(),
          })),
        })),

      removeMatchPlayer: (planId, playerId) =>
        set((s) => ({
          items: patchMatch(s.items, planId, (plan) => ({
            ...plan,
            roster: plan.roster.filter((p) => p.id !== playerId),
            updatedAt: new Date().toISOString(),
          })),
        })),

      updateMatchSlot: (planId, slotId, updates) =>
        set((s) => ({
          items: patchMatch(s.items, planId, (plan) => ({
            ...plan,
            slots: plan.slots.map((sl) => (sl.id === slotId ? { ...sl, ...updates } : sl)),
            updatedAt: new Date().toISOString(),
          })),
        })),
    }),
    { name: 'coach-saved-plans' },
  ),
)
