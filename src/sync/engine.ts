import { create } from 'zustand'
import { useSavedPlansStore } from '../store'
import type { SavedItem } from '../types'
import { stableHash } from './hash'
import type { PlansApi, RemoteDocument } from './types'

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error'

interface SyncStatus {
  state: SyncState
  lastSyncedAt: string | null
  /** Ids of plans that could not be synced in the last run. */
  failedIds: string[]
}

export const useSyncStatus = create<SyncStatus>(() => ({ state: 'idle', lastSyncedAt: null, failedIds: [] }))

export const CONFLICT_SUFFIX = ' (conflict copy)'

const store = () => useSavedPlansStore.getState()
const itemById = (id: string) => store().items.find((i) => i.plan.id === id)
const canWrite = (role: string | undefined) => role === 'owner' || role === 'editor'

function isOffline(error: unknown): boolean {
  // fetch rejects with TypeError when the network is unreachable.
  return error instanceof TypeError || (typeof navigator !== 'undefined' && navigator.onLine === false)
}

/**
 * Keep the local copy and the server's copy of a plan side by side: the
 * local edits move to a new local-only plan, the original id takes the server version.
 */
function keepBoth(current: RemoteDocument) {
  store().forkLocal(current.id, CONFLICT_SUFFIX)
  store().applyRemote(current)
}

async function push(api: PlansApi, item: SavedItem, baseVersion: number): Promise<void> {
  const id = item.plan.id
  const sentHash = stableHash(item)
  const outcome = await api.put(item, baseVersion)
  switch (outcome.kind) {
    case 'saved':
      // Record the hash of what was sent; edits made meanwhile stay dirty for the next run.
      store().setSyncMeta(id, { version: outcome.version, role: store().syncMeta[id]?.role ?? 'owner', hash: sentHash })
      return
    case 'conflict':
      keepBoth(outcome.current)
      return
    case 'id-taken':
      store().reidLocal(id)
      return
    case 'rejected': {
      // Deleted elsewhere, access removed or read-only now: keep the edits as an own plan.
      if (outcome.status === 403) {
        const current = await api.get(id)
        if (current) return keepBoth(current)
      }
      store().reidLocal(id)
    }
  }
}

/** One full reconciliation of local plans with the server. */
export async function syncOnce(api: PlansApi): Promise<{ failedIds: string[] }> {
  const remote = new Map((await api.list()).map((r) => [r.id, r]))
  const failedIds: string[] = []
  const attempt = async (id: string, fn: () => Promise<void>) => {
    try {
      await fn()
    } catch (error) {
      if (isOffline(error)) throw error
      console.warn(`Sync failed for plan ${id}`, error)
      failedIds.push(id)
    }
  }

  // Plans deleted on this device since the last sync.
  for (const id of Object.keys(store().syncMeta)) {
    if (itemById(id)) continue
    await attempt(id, async () => {
      if (remote.has(id)) await api.remove(id)
      store().setSyncMeta(id, null)
      remote.delete(id)
    })
  }

  for (const item of [...store().items]) {
    const id = item.plan.id
    const meta = store().syncMeta[id]
    const r = remote.get(id)
    remote.delete(id)
    await attempt(id, async () => {
      const latest = itemById(id)
      if (!latest) return
      const dirty = !meta || meta.hash !== stableHash(latest)
      if (!meta) return push(api, latest, 0)
      if (!r) {
        // Gone from the server (deleted elsewhere or access removed).
        if (dirty) store().reidLocal(id)
        else store().removeLocal(id)
        return
      }
      if (r.version > meta.version || r.role !== meta.role) {
        const current = await api.get(id)
        if (!current) return
        const stillSame = itemById(id) && stableHash(itemById(id)) === stableHash(latest)
        if (!stillSame) return // edited during fetch; reconcile next run
        if (dirty && r.version > meta.version) keepBoth(current)
        else store().applyRemote(current)
        return
      }
      if (dirty && canWrite(meta.role)) return push(api, latest, meta.version)
    })
  }

  // Plans created or shared elsewhere.
  for (const r of remote.values()) {
    await attempt(r.id, async () => {
      const doc = await api.get(r.id)
      if (doc && !itemById(r.id)) store().applyRemote(doc)
    })
  }

  return { failedIds }
}

export interface SyncController {
  /** Ask for a sync soon; coalesces with a run in progress. */
  request(delayMs?: number): void
  stop(): void
}

function contentFingerprint(): string {
  return store().items.map((i) => `${i.plan.id}:${stableHash(i)}`).join('|')
}

/** Local changes the server could accept: new plans, writable edits, local deletes. */
export function hasPendingWork(skipIds: string[] = []): boolean {
  const { items, syncMeta } = store()
  const ids = new Set(items.map((i) => i.plan.id))
  if (Object.keys(syncMeta).some((id) => !ids.has(id) && !skipIds.includes(id))) return true
  return items.some((i) => {
    if (skipIds.includes(i.plan.id)) return false
    const meta = syncMeta[i.plan.id]
    return !meta || (meta.hash !== stableHash(i) && canWrite(meta.role))
  })
}

const EDIT_DEBOUNCE_MS = 1500
const POLL_INTERVAL_MS = 60_000
const RETRY_MS = 15_000

/** Run sync on start, after local edits, on focus/online, and periodically. */
export function startSync(api: PlansApi): SyncController {
  let stopped = false
  let running = false
  let rerun = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const run = async () => {
    if (stopped) return
    if (running) {
      rerun = true
      return
    }
    running = true
    useSyncStatus.setState({ state: 'syncing' })
    try {
      const { failedIds } = await syncOnce(api)
      useSyncStatus.setState({ state: failedIds.length ? 'error' : 'idle', lastSyncedAt: new Date().toISOString(), failedIds })
      lastContent = contentFingerprint()
      if (hasPendingWork(failedIds)) schedule(EDIT_DEBOUNCE_MS)
    } catch (error) {
      if (!isOffline(error)) console.warn('Sync failed', error)
      useSyncStatus.setState({ state: isOffline(error) ? 'offline' : 'error' })
      schedule(RETRY_MS)
    } finally {
      running = false
      if (rerun && !stopped) {
        rerun = false
        void run()
      }
    }
  }

  function schedule(delayMs = 0) {
    if (stopped) return
    clearTimeout(timer)
    timer = setTimeout(() => void run(), delayMs)
  }

  // Sync's own writes happen while running; edits made meanwhile are caught
  // by the pending-work check after the run.
  let lastContent = contentFingerprint()
  const unsubscribe = useSavedPlansStore.subscribe(() => {
    const next = contentFingerprint()
    if (next === lastContent) return
    lastContent = next
    if (!running) schedule(EDIT_DEBOUNCE_MS)
  })

  const onWake = () => {
    if (typeof document === 'undefined' || document.visibilityState === 'visible') schedule()
  }
  const interval = setInterval(() => schedule(), POLL_INTERVAL_MS)
  if (typeof window !== 'undefined') {
    window.addEventListener('online', onWake)
    window.addEventListener('focus', onWake)
    document.addEventListener('visibilitychange', onWake)
  }
  schedule()

  return {
    request: schedule,
    stop() {
      stopped = true
      clearTimeout(timer)
      clearInterval(interval)
      unsubscribe()
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', onWake)
        window.removeEventListener('focus', onWake)
        document.removeEventListener('visibilitychange', onWake)
      }
      useSyncStatus.setState({ state: 'idle' })
    },
  }
}
