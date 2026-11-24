import { useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'coach-planner-theme'
const THEME_COLORS: Record<Theme, string> = { light: '#1d4ed8', dark: '#0f172a' }

export function readStoredTheme(): Theme | null {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

export function systemTheme(): Theme {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function resolveTheme(): Theme {
  return readStoredTheme() ?? systemTheme()
}

const listeners = new Set<() => void>()
let current: Theme | null = null

function getTheme(): Theme {
  return (current ??= resolveTheme())
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme])
}

export function setTheme(theme: Theme) {
  current = theme
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    /* storage unavailable: theme still applies for this session */
  }
  applyTheme(theme)
  listeners.forEach((l) => l())
}

export function initTheme() {
  applyTheme(getTheme())
  if (typeof matchMedia === 'function') {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (readStoredTheme()) return
      current = systemTheme()
      applyTheme(current)
      listeners.forEach((l) => l())
    })
  }
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const theme = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    getTheme,
    () => 'light' as Theme,
  )
  return [theme, setTheme]
}
