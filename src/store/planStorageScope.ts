import type { SavedItem } from '../types'

/** localStorage key for plans made while signed out (the original key). */
export const ANON_PLANS_KEY = 'coach-saved-plans'
/** Remembers which account's plans were last open, so a reload or offline start shows them immediately. */
const ACTIVE_SCOPE_KEY = 'coach-active-plan-scope'

export function plansStorageKey(userId: string | null): string {
  return userId ? `${ANON_PLANS_KEY}:${userId}` : ANON_PLANS_KEY
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function readActiveScope(): string | null {
  try {
    return storage()?.getItem(ACTIVE_SCOPE_KEY) || null
  } catch {
    return null
  }
}

export function writeActiveScope(userId: string | null): void {
  try {
    if (userId) storage()?.setItem(ACTIVE_SCOPE_KEY, userId)
    else storage()?.removeItem(ACTIVE_SCOPE_KEY)
  } catch {
    // Storage unavailable (private mode); scope falls back to signed-out plans next load.
  }
}

interface PersistedPlans {
  state?: { items?: SavedItem[]; currentMatchId?: string | null }
  version?: number
}

function readPersisted(key: string): PersistedPlans | null {
  try {
    const raw = storage()?.getItem(key)
    return raw ? (JSON.parse(raw) as PersistedPlans) : null
  } catch {
    return null
  }
}

/**
 * Merge signed-out items into an account's items. Account copies win on id
 * collisions; signed-out-only items are appended.
 */
export function mergeAnonymousItems(accountItems: SavedItem[], anonItems: SavedItem[]): SavedItem[] {
  const ids = new Set(accountItems.map((item) => item.plan.id))
  return [...accountItems, ...anonItems.filter((item) => !ids.has(item.plan.id))]
}

/**
 * Move plans created while signed out into the given account's local bucket,
 * then clear the signed-out bucket so they are not claimed twice.
 * Returns true when the account bucket changed.
 */
export function claimAnonymousPlans(userId: string): boolean {
  const store = storage()
  if (!store) return false
  const anon = readPersisted(ANON_PLANS_KEY)
  const anonItems = anon?.state?.items ?? []
  if (!anonItems.length) return false
  const accountKey = plansStorageKey(userId)
  const account = readPersisted(accountKey)
  const next: PersistedPlans = {
    version: account?.version ?? anon?.version ?? 0,
    state: {
      ...account?.state,
      items: mergeAnonymousItems(account?.state?.items ?? [], anonItems),
      currentMatchId: account?.state?.currentMatchId ?? anon?.state?.currentMatchId ?? null,
    },
  }
  try {
    store.setItem(accountKey, JSON.stringify(next))
    store.removeItem(ANON_PLANS_KEY)
    return true
  } catch {
    // Quota or access failure: leave the signed-out bucket in place rather than lose data.
    return false
  }
}
