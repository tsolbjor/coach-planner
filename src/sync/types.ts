import type { SavedItem } from '../types'

export type PlanRole = 'owner' | 'editor' | 'viewer'

/** What this device last agreed with the server about one plan. */
export interface SyncMeta {
  version: number
  role: PlanRole
  /** stableHash of the local item as last synced; differs once edited locally. */
  hash: string
}

export interface RemoteSummary {
  id: string
  kind: SavedItem['kind']
  name: string
  version: number
  role: PlanRole
  updatedAt: string
}

export interface RemoteDocument extends RemoteSummary {
  data: SavedItem['plan']
}

export type PutOutcome =
  | { kind: 'saved'; version: number }
  | { kind: 'conflict'; current: RemoteDocument }
  | { kind: 'id-taken' }
  /** Deleted, access removed, or now read-only. */
  | { kind: 'rejected'; status: 403 | 404 | 410 }

export interface PlansApi {
  list(): Promise<RemoteSummary[]>
  get(id: string): Promise<RemoteDocument | null>
  put(item: SavedItem, baseVersion: number): Promise<PutOutcome>
  remove(id: string): Promise<void>
}
