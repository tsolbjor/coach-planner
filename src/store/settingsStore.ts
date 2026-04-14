import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SportConfig } from '../types'
import { SOCCER_PRESET } from '../constants/sportPresets'

interface SettingsState {
  sportConfig: SportConfig
  benchStintMinutes: number
  setSportConfig: (config: SportConfig) => void
  setBenchStintMinutes: (n: number) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      sportConfig: SOCCER_PRESET,
      benchStintMinutes: 5,
      setSportConfig: (config) => set({ sportConfig: config }),
      setBenchStintMinutes: (n) => set({ benchStintMinutes: n }),
    }),
    { name: 'coach-settings' },
  ),
)
