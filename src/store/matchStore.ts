import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { MatchPlan, TimeSlot } from '../types'

interface MatchState {
  plan: MatchPlan | null
  setPlan: (plan: MatchPlan) => void
  clearPlan: () => void
  updateSlot: (slotId: string, updates: Partial<TimeSlot>) => void
  lockSlot: (slotId: string) => void
  unlockSlot: (slotId: string) => void
  setAbsent: (playerIds: string[]) => void
  newPlan: (base: Omit<MatchPlan, 'id' | 'createdAt' | 'updatedAt'>) => MatchPlan
}

export const useMatchStore = create<MatchState>()((set, get) => ({
  plan: null,
  setPlan: (plan) => set({ plan }),
  clearPlan: () => set({ plan: null }),
  updateSlot: (slotId, updates) =>
    set((s) => {
      if (!s.plan) return s
      return {
        plan: {
          ...s.plan,
          updatedAt: new Date().toISOString(),
          slots: s.plan.slots.map((sl) =>
            sl.id === slotId ? { ...sl, ...updates } : sl,
          ),
        },
      }
    }),
  lockSlot: (slotId) => get().updateSlot(slotId, { locked: true }),
  unlockSlot: (slotId) => get().updateSlot(slotId, { locked: false }),
  setAbsent: (playerIds) =>
    set((s) => {
      if (!s.plan) return s
      return { plan: { ...s.plan, absentPlayerIds: playerIds } }
    }),
  newPlan: (base) => {
    const plan: MatchPlan = {
      ...base,
      id: nanoid(8),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    set({ plan })
    return plan
  },
}))
