import { PGlite } from '@electric-sql/pglite'
import { eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setDb, type Db } from '../db/client.js'
import * as schema from '../db/schema.js'
import { setProfileFetcher } from '../users.js'

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

const planRoute = await import('../../api/plans/[id]/index.js')
const membersRoute = await import('../../api/plans/[id]/members/index.js')
const memberRoute = await import('../../api/plans/[id]/members/[userId].js')
const invitesRoute = await import('../../api/plans/[id]/invites/index.js')
const inviteRoute = await import('../../api/plans/[id]/invites/[inviteId].js')
const acceptRoute = await import('../../api/invites/accept.js')
const listRoute = await import('../../api/plans/index.js')

let db: Db
const PLAN = 'plan_shared01'

const req = (user: string, path: string, method = 'GET', body?: unknown) =>
  new Request(`https://coach.test/api${path}`, {
    method,
    headers: { authorization: `Bearer ${user}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
const read = async (res: Response) => ({ status: res.status, body: res.status === 204 ? null : await res.json() })

const createPlan = (user: string, id = PLAN) =>
  planRoute.PUT(req(user, `/plans/${id}`, 'PUT', { kind: 'match', baseVersion: 0, data: { id, name: 'Cup' } }))
const invite = async (user: string, role: 'editor' | 'viewer', id = PLAN) =>
  read(await invitesRoute.POST(req(user, `/plans/${id}/invites`, 'POST', { role })))
const accept = async (user: string, token: string) => read(await acceptRoute.POST(req(user, '/invites/accept', 'POST', { token })))
const sharing = async (user: string) => read(await membersRoute.GET(req(user, `/plans/${PLAN}/members`)))
const save = async (user: string, baseVersion: number) =>
  (await planRoute.PUT(req(user, `/plans/${PLAN}`, 'PUT', { kind: 'match', baseVersion, data: { id: PLAN, name: 'Cup' } }))).status

beforeEach(async () => {
  db = drizzle(new PGlite(), { schema }) as unknown as Db
  await migrate(db as never, { migrationsFolder: 'server/db/migrations' })
  setDb(db)
  setProfileFetcher(async (userId) => ({ email: `${userId}@example.test`, name: userId.toUpperCase() }))
  await createPlan('alice')
})

describe('sharing', () => {
  it('invites a viewer who can read but not write', async () => {
    const created = await invite('alice', 'viewer')
    expect(created.status).toBe(201)
    expect(created.body.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    const [stored] = await db.select().from(schema.planInvites)
    expect(stored!.tokenHash).not.toBe(created.body.token)

    expect(await accept('bob', created.body.token)).toEqual({ status: 200, body: { planId: PLAN, role: 'viewer' } })
    expect((await read(await planRoute.GET(req('bob', `/plans/${PLAN}`)))).body).toMatchObject({ role: 'viewer', ownerName: 'ALICE' })
    expect(await save('bob', 1)).toBe(403)
    const list = await read(await listRoute.GET(req('bob', '/plans')))
    expect(list.body.plans).toMatchObject([{ id: PLAN, role: 'viewer', ownerName: 'ALICE' }])
  })

  it('lets editors write and see members, but only the owner manages', async () => {
    const { body } = await invite('alice', 'editor')
    await accept('bob', body.token)
    expect(await save('bob', 1)).toBe(200)
    const seen = await sharing('bob')
    expect(seen.body).toMatchObject({ owner: { userId: 'alice', name: 'ALICE' }, members: [{ userId: 'bob', role: 'editor' }], invites: [] })
    expect((await invite('bob', 'editor')).status).toBe(403)
    expect((await read(await memberRoute.PATCH(req('bob', `/plans/${PLAN}/members/bob`, 'PATCH', { role: 'viewer' })))).status).toBe(403)
  })

  it('hides sharing details from viewers and strangers', async () => {
    const { body } = await invite('alice', 'viewer')
    await accept('carol', body.token)
    expect((await sharing('carol')).status).toBe(403)
    expect((await sharing('mallory')).status).toBe(404)
    expect((await invite('mallory', 'editor')).status).toBe(404)
  })

  it('owner changes roles and removes members', async () => {
    const { body } = await invite('alice', 'editor')
    await accept('bob', body.token)
    expect((await memberRoute.PATCH(req('alice', `/plans/${PLAN}/members/bob`, 'PATCH', { role: 'viewer' }))).status).toBe(204)
    expect(await save('bob', 1)).toBe(403)
    expect((await memberRoute.DELETE(req('alice', `/plans/${PLAN}/members/bob`, 'DELETE'))).status).toBe(204)
    expect((await read(await planRoute.GET(req('bob', `/plans/${PLAN}`)))).status).toBe(404)
  })

  it('never downgrades on accept and ignores the owner accepting', async () => {
    const editor = await invite('alice', 'editor')
    const viewer = await invite('alice', 'viewer')
    await accept('bob', editor.body.token)
    expect((await accept('bob', viewer.body.token)).body.role).toBe('editor')
    expect((await accept('alice', viewer.body.token)).body.role).toBe('owner')
    expect((await sharing('alice')).body.members).toHaveLength(1)
  })

  it('rejects revoked, expired, unknown and exhausted invites the same way', async () => {
    const revoked = await invite('alice', 'viewer')
    expect((await inviteRoute.DELETE(req('alice', `/plans/${PLAN}/invites/${revoked.body.id}`, 'DELETE'))).status).toBe(204)
    expect(await accept('bob', revoked.body.token)).toMatchObject({ status: 404 })

    const expired = await invite('alice', 'viewer')
    await db.update(schema.planInvites).set({ expiresAt: sql`now() - interval '1 minute'` }).where(eq(schema.planInvites.id, expired.body.id))
    expect(await accept('bob', expired.body.token)).toMatchObject({ status: 404 })

    expect(await accept('bob', 'x'.repeat(43))).toMatchObject({ status: 404 })

    const limited = await invite('alice', 'viewer')
    await db.update(schema.planInvites).set({ maxUses: 1 }).where(eq(schema.planInvites.id, limited.body.id))
    expect((await accept('bob', limited.body.token)).status).toBe(200)
    expect((await accept('carol', limited.body.token)).status).toBe(404)

    expect((await sharing('alice')).body.invites.map((i: { id: string }) => i.id)).toEqual([limited.body.id])
  })

  it('stops invites to deleted plans and hides revoke from others', async () => {
    const { body } = await invite('alice', 'viewer')
    await createPlan('mallory', 'plan_mallory1')
    expect((await inviteRoute.DELETE(req('mallory', `/plans/plan_mallory1/invites/${body.id}`, 'DELETE'))).status).toBe(404)
    await planRoute.DELETE(req('alice', `/plans/${PLAN}`, 'DELETE'))
    expect((await accept('bob', body.token)).status).toBe(404)
  })
})
