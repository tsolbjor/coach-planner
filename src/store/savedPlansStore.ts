import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SavedItem, MatchPlan, TournamentPlan } from '../types'

interface SavedPlansState {
  items: SavedItem[]
  saveMatch: (plan: MatchPlan) => void
  saveTournament: (plan: TournamentPlan) => void
  deleteSaved: (id: string) => void
  getSaved: (id: string) => SavedItem | undefined
}

function planId(item: SavedItem): string {
  return item.kind === 'match' ? item.plan.id : item.plan.id
}

export const useSavedPlansStore = create<SavedPlansState>()(
  persist(
    (set, get) => ({
      items: [],
      saveMatch: (plan) =>
        set((s) => {
          const existing = s.items.findIndex(
            (i) => i.kind === 'match' && i.plan.id === plan.id,
          )
          const item: SavedItem = { kind: 'match', plan }
          if (existing >= 0) {
            const items = [...s.items]
            items[existing] = item
            return { items }
          }
          return { items: [...s.items, item] }
        }),
      saveTournament: (plan) =>
        set((s) => {
          const existing = s.items.findIndex(
            (i) => i.kind === 'tournament' && i.plan.id === plan.id,
          )
          const item: SavedItem = { kind: 'tournament', plan }
          if (existing >= 0) {
            const items = [...s.items]
            items[existing] = item
            return { items }
          }
          return { items: [...s.items, item] }
        }),
      deleteSaved: (id) =>
        set((s) => ({ items: s.items.filter((i) => planId(i) !== id) })),
      getSaved: (id) => get().items.find((i) => planId(i) === id),
    }),
    { name: 'coach-saved-plans' },
  ),
)
