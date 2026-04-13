import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SportConfig, KeeperMode } from '../types'
import { SOCCER_PRESET } from '../constants/sportPresets'

interface SettingsState {
  sportConfig: SportConfig
  keeperMode: KeeperMode
  subsPerPeriod: number
  setSportConfig: (config: SportConfig) => void
  setKeeperMode: (mode: KeeperMode) => void
  setSubsPerPeriod: (n: number) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      sportConfig: SOCCER_PRESET,
      keeperMode: 'rotating',
      subsPerPeriod: 3,
      setSportConfig: (config) => set({ sportConfig: config }),
      setKeeperMode: (mode) => set({ keeperMode: mode }),
      setSubsPerPeriod: (n) => set({ subsPerPeriod: n }),
    }),
    { name: 'coach-settings' },
  ),
)
