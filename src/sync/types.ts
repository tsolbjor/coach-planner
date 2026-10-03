import type { SavedItem } from '../types'

export type PlanRole = 'owner' | 'editor' | 'viewer'

/** What this device last agreed with the server about one plan. */
export interface SyncMeta {
  version: number
  role: PlanRole
  /** stableHash of the local item as last synced; differs once edited locally. */
  hash: string
  /** Owner's display name, shown for plans shared with this account. */
  ownerName?: string | null
}

export interface RemoteSummary {
  id: string
  kind: SavedItem['kind']
  name: string
  version: number
  role: PlanRole
  ownerName: string | null
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

export type MemberRole = 'editor' | 'viewer'

export interface Person {
  userId: string
  name: string | null
  email: string | null
}

export interface InviteSummary {
  id: string
  role: MemberRole
  expiresAt: string
  uses: number
}

export interface SharingInfo {
  owner: Person
  members: (Person & { role: MemberRole })[]
  invites: InviteSummary[]
}
