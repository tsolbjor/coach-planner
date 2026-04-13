import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type { Player } from '../types'

interface RosterState {
  players: Player[]
  addPlayer: (player: Omit<Player, 'id'>) => void
  updatePlayer: (id: string, updates: Partial<Omit<Player, 'id'>>) => void
  removePlayer: (id: string) => void
  reorderPlayers: (players: Player[]) => void
}

export const useRosterStore = create<RosterState>()(
  persist(
    (set) => ({
      players: [],
      addPlayer: (player) =>
        set((s) => ({ players: [...s.players, { ...player, id: nanoid(8) }] })),
      updatePlayer: (id, updates) =>
        set((s) => ({
          players: s.players.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        })),
      removePlayer: (id) =>
        set((s) => ({ players: s.players.filter((p) => p.id !== id) })),
      reorderPlayers: (players) => set({ players }),
    }),
    { name: 'coach-roster' },
  ),
)
