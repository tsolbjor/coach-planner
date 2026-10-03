import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setDb, type Db } from '../db/client.js'
import * as schema from '../db/schema.js'
import { setProfileFetcher } from '../users.js'

// Treat the bearer token as the user id so handlers can be exercised end to end.
vi.mock('../auth.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../auth.js')>()
  return {
    ...actual,
    requireUserId: async (request: Request) => {
      const token = actual.bearerToken(request)
      if (!token) throw new actual.HttpError(401, 'Missing bearer token')
      return token
    },
  }
})

const list = await import('../../api/plans/index.js')
const item = await import('../../api/plans/[id]/index.js')

let db: Db

beforeEach(async () => {
  const client = new PGlite()
  db = drizzle(client, { schema }) as unknown as Db
  await migrate(db as never, { migrationsFolder: 'server/db/migrations' })
  setDb(db)
  setProfileFetcher(async () => ({ email: null, name: null }))
})

const url = (id = '') => `https://coach.test/api/plans${id ? `/${id}` : ''}`
const as = (user: string | null, method = 'GET', body?: unknown): RequestInit => ({
  method,
  headers: { ...(user ? { authorization: `Bearer ${user}` } : {}), 'content-type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
})
const plan = (id: string, name = 'Saturday') => ({ id, name, roster: [] })

async function put(user: string, id: string, baseVersion: number, data = plan(id), kind = 'match') {
  const res = await item.PUT(new Request(url(id), as(user, 'PUT', { kind, baseVersion, data })))
  return { status: res.status, body: res.status === 204 ? null : await res.json() }
}
async function get(user: string | null, id: string) {
  const res = await item.GET(new Request(url(id), as(user)))
  return { status: res.status, body: await res.json() }
}
async function listFor(user: string) {
  const res = await list.GET(new Request(url(), as(user)))
  return (await res.json()).plans as { id: string; version: number; role: string }[]
}
async function addMember(planId: string, userId: string, role: 'editor' | 'viewer') {
  await db.insert(schema.users).values({ id: userId }).onConflictDoNothing()
  await db.insert(schema.planMembers).values({ planId, userId, role })
}

describe('plans API', () => {
  it('requires authentication', async () => {
    expect((await get(null, 'plan_abc123')).status).toBe(401)
  })

  it('creates, reads, updates and lists a plan for its owner', async () => {
    expect(await put('alice', 'plan_abc123', 0)).toMatchObject({ status: 201, body: { version: 1 } })
    expect(await put('alice', 'plan_abc123', 1, plan('plan_abc123', 'Renamed'))).toMatchObject({ status: 200, body: { version: 2 } })
    const doc = await get('alice', 'plan_abc123')
    expect(doc).toMatchObject({ status: 200, body: { role: 'owner', version: 2, name: 'Renamed', data: { name: 'Renamed' } } })
    expect(await listFor('alice')).toMatchObject([{ id: 'plan_abc123', version: 2, role: 'owner' }])
  })

  it('returns the current document on a stale write', async () => {
    await put('alice', 'plan_abc123', 0)
    await put('alice', 'plan_abc123', 1, plan('plan_abc123', 'Device A'))
    const stale = await put('alice', 'plan_abc123', 1, plan('plan_abc123', 'Device B'))
    expect(stale).toMatchObject({ status: 409, body: { current: { version: 2, data: { name: 'Device A' } } } })
  })

  it('hides other users plans and rejects reusing their id', async () => {
    await put('alice', 'plan_abc123', 0)
    expect((await get('mallory', 'plan_abc123')).status).toBe(404)
    expect(await listFor('mallory')).toEqual([])
    const taken = await put('mallory', 'plan_abc123', 0)
    expect(taken.status).toBe(409)
    expect(taken.body.current).toBeUndefined()
    expect((await put('mallory', 'plan_abc123', 1)).status).toBe(404)
    expect((await item.DELETE(new Request(url('plan_abc123'), as('mallory', 'DELETE')))).status).toBe(404)
    expect((await get('alice', 'plan_abc123')).body.version).toBe(1)
  })

  it('lets editors write and keeps viewers read-only', async () => {
    await put('alice', 'plan_abc123', 0)
    await addMember('plan_abc123', 'bob', 'editor')
    await addMember('plan_abc123', 'carol', 'viewer')
    expect(await put('bob', 'plan_abc123', 1)).toMatchObject({ status: 200, body: { version: 2 } })
    expect((await put('carol', 'plan_abc123', 2)).status).toBe(403)
    expect(await get('carol', 'plan_abc123')).toMatchObject({ status: 200, body: { role: 'viewer', version: 2 } })
    expect(await listFor('bob')).toMatchObject([{ id: 'plan_abc123', role: 'editor' }])
  })

  it('soft-deletes for the owner and lets members leave', async () => {
    await put('alice', 'plan_abc123', 0)
    await addMember('plan_abc123', 'bob', 'editor')
    expect((await item.DELETE(new Request(url('plan_abc123'), as('bob', 'DELETE')))).status).toBe(204)
    expect(await listFor('bob')).toEqual([])
    expect(await listFor('alice')).toHaveLength(1)
    expect((await item.DELETE(new Request(url('plan_abc123'), as('alice', 'DELETE')))).status).toBe(204)
    expect(await listFor('alice')).toEqual([])
    expect((await get('alice', 'plan_abc123')).status).toBe(404)
    expect((await put('alice', 'plan_abc123', 1)).status).toBe(410)
  })

  it('validates ids, payloads and kind changes', async () => {
    expect((await put('alice', 'bad id!', 0)).status).toBe(400)
    expect((await put('alice', 'plan_abc123', 0, plan('other_id1'))).status).toBe(400)
    await put('alice', 'plan_abc123', 0)
    expect((await put('alice', 'plan_abc123', 1, plan('plan_abc123'), 'tournament')).status).toBe(400)
    const huge = { ...plan('plan_abc123'), blob: 'x'.repeat(600 * 1024) }
    expect((await put('alice', 'plan_abc123', 1, huge)).status).toBe(413)
  })
})
