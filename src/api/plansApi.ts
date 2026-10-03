import type { SavedItem } from '../types'
import type { MemberRole, PlansApi, PutOutcome, RemoteDocument, RemoteSummary, SharingInfo } from '../sync/types'

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

type GetToken = () => Promise<string | null>

function createRequester(getToken: GetToken, base: string) {
  return async function request(path: string, init: RequestInit = {}): Promise<Response> {
    const token = await getToken()
    if (!token) throw new ApiError(401, 'Not signed in')
    return fetch(`${base}${path}`, {
      ...init,
      headers: { ...init.headers, authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    })
  }
}

async function fail(res: Response): Promise<never> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null
  throw new ApiError(res.status, body?.error ?? res.statusText)
}

async function expectOk(res: Response): Promise<void> {
  if (!res.ok) await fail(res)
}

const planPath = (id: string) => `/plans/${encodeURIComponent(id)}`

export function createPlansApi(getToken: GetToken, base = '/api'): PlansApi {
  const request = createRequester(getToken, base)
  return {
    async list() {
      const res = await request('/plans')
      if (!res.ok) return fail(res)
      return ((await res.json()) as { plans: RemoteSummary[] }).plans
    },

    async get(id) {
      const res = await request(planPath(id))
      if (res.status === 404) return null
      if (!res.ok) return fail(res)
      return (await res.json()) as RemoteDocument
    },

    async put(item: SavedItem, baseVersion: number): Promise<PutOutcome> {
      const res = await request(planPath(item.plan.id), {
        method: 'PUT',
        body: JSON.stringify({ kind: item.kind, baseVersion, data: item.plan }),
      })
      if (res.ok) return { kind: 'saved', version: ((await res.json()) as { version: number }).version }
      if (res.status === 409) {
        const body = (await res.json().catch(() => ({}))) as { current?: RemoteDocument }
        return body.current ? { kind: 'conflict', current: body.current } : { kind: 'id-taken' }
      }
      if (res.status === 403 || res.status === 404 || res.status === 410) return { kind: 'rejected', status: res.status }
      return fail(res)
    },

    async remove(id) {
      const res = await request(planPath(id), { method: 'DELETE' })
      if (!res.ok && res.status !== 404) await fail(res)
    },
  }
}

export interface SharingApi {
  getSharing(planId: string): Promise<SharingInfo>
  createInvite(planId: string, role: MemberRole): Promise<{ id: string; token: string; role: MemberRole; expiresAt: string }>
  revokeInvite(planId: string, inviteId: string): Promise<void>
  updateMember(planId: string, userId: string, role: MemberRole): Promise<void>
  removeMember(planId: string, userId: string): Promise<void>
  acceptInvite(token: string): Promise<{ planId: string; role: string }>
}

export function createSharingApi(getToken: GetToken, base = '/api'): SharingApi {
  const request = createRequester(getToken, base)
  return {
    async getSharing(planId) {
      const res = await request(`${planPath(planId)}/members`)
      if (!res.ok) return fail(res)
      return (await res.json()) as SharingInfo
    },
    async createInvite(planId, role) {
      const res = await request(`${planPath(planId)}/invites`, { method: 'POST', body: JSON.stringify({ role }) })
      if (!res.ok) return fail(res)
      return res.json()
    },
    async revokeInvite(planId, inviteId) {
      await expectOk(await request(`${planPath(planId)}/invites/${encodeURIComponent(inviteId)}`, { method: 'DELETE' }))
    },
    async updateMember(planId, userId, role) {
      await expectOk(await request(`${planPath(planId)}/members/${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }))
    },
    async removeMember(planId, userId) {
      await expectOk(await request(`${planPath(planId)}/members/${encodeURIComponent(userId)}`, { method: 'DELETE' }))
    },
    async acceptInvite(token) {
      const res = await request('/invites/accept', { method: 'POST', body: JSON.stringify({ token }) })
      if (!res.ok) return fail(res)
      return res.json()
    },
  }
}

/** Absolute link that opens the invite page of this app. */
export function inviteUrl(token: string): string {
  const base = window.location.href.split('#')[0]
  return `${base}#/invite/${token}`
}
