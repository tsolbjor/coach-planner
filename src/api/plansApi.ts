import type { SavedItem } from '../types'
import type { PlansApi, PutOutcome, RemoteDocument, RemoteSummary } from '../sync/types'

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

type GetToken = () => Promise<string | null>

export function createPlansApi(getToken: GetToken, base = '/api'): PlansApi {
  async function request(path: string, init: RequestInit = {}): Promise<Response> {
    const token = await getToken()
    if (!token) throw new ApiError(401, 'Not signed in')
    return fetch(`${base}${path}`, {
      ...init,
      headers: { ...init.headers, authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    })
  }

  async function fail(res: Response): Promise<never> {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new ApiError(res.status, body?.error ?? res.statusText)
  }

  const planPath = (id: string) => `/plans/${encodeURIComponent(id)}`

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
