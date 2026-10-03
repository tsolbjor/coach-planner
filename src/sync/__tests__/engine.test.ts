import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatchPlan, SavedItem } from '../../types'
import { makeFiveASide, makePlayers } from '../../scheduler/__tests__/fixtures'
import { useSavedPlansStore } from '../../store'
import { CONFLICT_SUFFIX, hasPendingWork, syncOnce } from '../engine'
import type { PlanRole, PlansApi, PutOutcome, RemoteDocument } from '../types'

vi.hoisted(() => {
  const values = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
    clear: () => values.clear(),
  } })
})

/** In-memory server with the same version/role rules as server/plans.ts. */
class FakeServer {
  docs = new Map<string, { kind: SavedItem['kind']; data: SavedItem['plan']; version: number; owner: string; deleted: boolean }>()
  members = new Map<string, PlanRole>() // `${planId}:${user}`

  role(id: string, user: string): PlanRole | null {
    const doc = this.docs.get(id)
    if (!doc) return null
    return doc.owner === user ? 'owner' : this.members.get(`${id}:${user}`) ?? null
  }

  doc(id: string, user: string): RemoteDocument {
    const d = this.docs.get(id)!
    // Simulate the jsonb round trip.
    return { id, kind: d.kind, name: d.data.name, version: d.version, role: this.role(id, user)!, ownerName: d.owner, updatedAt: '', data: JSON.parse(JSON.stringify(d.data)) }
  }

  api(user: string): PlansApi {
    return {
      list: async () => [...this.docs.entries()]
        .filter(([id, d]) => !d.deleted && this.role(id, user))
        .map(([id]) => { const { data: _data, ...summary } = this.doc(id, user); return summary }),
      get: async (id) => {
        const d = this.docs.get(id)
        return d && !d.deleted && this.role(id, user) ? this.doc(id, user) : null
      },
      put: async (item, baseVersion): Promise<PutOutcome> => {
        const id = item.plan.id
        const d = this.docs.get(id)
        if (!d) {
          if (baseVersion !== 0) return { kind: 'rejected', status: 410 }
          this.docs.set(id, { kind: item.kind, data: structuredClone(item.plan), version: 1, owner: user, deleted: false })
          return { kind: 'saved', version: 1 }
        }
        const role = this.role(id, user)
        if (!role) return baseVersion === 0 ? { kind: 'id-taken' } : { kind: 'rejected', status: 404 }
        if (d.deleted) return { kind: 'rejected', status: 410 }
        if (role === 'viewer') return { kind: 'rejected', status: 403 }
        if (d.version !== baseVersion) return { kind: 'conflict', current: this.doc(id, user) }
        d.data = structuredClone(item.plan)
        d.version++
        return { kind: 'saved', version: d.version }
      },
      remove: async (id) => {
        const role = this.role(id, user)
        if (role === 'owner') this.docs.get(id)!.deleted = true
        else if (role) this.members.delete(`${id}:${user}`)
      },
    }
  }
}

function base(name: string): Omit<MatchPlan, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name,
    sportConfig: makeFiveASide({ periodCount: 2, periodDurationMinutes: 20 }),
    roster: makePlayers(7),
    benchStintMinutes: 5,
    matchCount: 1,
    absentPlayerIds: [],
    pins: {},
    slots: [],
    changeKeeperMidPeriod: false,
    maxBenchSegments: 1,
    minSubsPerSegment: 0,
    maxSubsPerSegment: 2,
  }
}

type DeviceState = Pick<ReturnType<typeof useSavedPlansStore.getState>, 'items' | 'currentMatchId' | 'syncMeta'>
const empty = (): DeviceState => ({ items: [], currentMatchId: null, syncMeta: {} })

let server: FakeServer
let devices: Record<string, DeviceState>
let active: string

/** Switch the singleton store between simulated devices. */
function on(device: string) {
  if (active) {
    const { items, currentMatchId, syncMeta } = useSavedPlansStore.getState()
    devices[active] = { items, currentMatchId, syncMeta }
  }
  active = device
  useSavedPlansStore.setState(devices[device] ?? empty())
}

const s = () => useSavedPlansStore.getState()
const names = () => s().items.map((i) => i.plan.name).sort()
const rename = (id: string, name: string) => s().updateMatch(id, { name })

beforeEach(() => {
  server = new FakeServer()
  devices = {}
  active = ''
  on('phone')
})

describe('syncOnce', () => {
  it('uploads local plans and brings them to another device', async () => {
    const plan = s().createMatch(base('Saturday'))
    await syncOnce(server.api('alice'))
    expect(server.docs.get(plan.id)?.version).toBe(1)
    expect(hasPendingWork()).toBe(false)

    on('laptop')
    await syncOnce(server.api('alice'))
    expect(names()).toEqual(['Saturday'])
    expect(hasPendingWork()).toBe(false)
  })

  it('is a no-op when nothing changed', async () => {
    s().createMatch(base('Saturday'))
    const api = server.api('alice')
    await syncOnce(api)
    const put = vi.spyOn(api, 'put')
    await syncOnce(api)
    expect(put).not.toHaveBeenCalled()
  })

  it('pushes edits and pulls them elsewhere', async () => {
    const plan = s().createMatch(base('Saturday'))
    await syncOnce(server.api('alice'))
    on('laptop')
    await syncOnce(server.api('alice'))
    on('phone')
    rename(plan.id, 'Sunday')
    await syncOnce(server.api('alice'))
    expect(server.docs.get(plan.id)?.version).toBe(2)
    on('laptop')
    await syncOnce(server.api('alice'))
    expect(names()).toEqual(['Sunday'])
  })

  it('keeps both versions when two devices edit the same plan', async () => {
    const plan = s().createMatch(base('Saturday'))
    await syncOnce(server.api('alice'))
    on('laptop')
    await syncOnce(server.api('alice'))
    rename(plan.id, 'Laptop edit')
    await syncOnce(server.api('alice'))
    on('phone')
    rename(plan.id, 'Phone edit')
    await syncOnce(server.api('alice'))
    expect(names()).toEqual(['Laptop edit', `Phone edit${CONFLICT_SUFFIX}`])
    await syncOnce(server.api('alice'))
    expect([...server.docs.values()].map((d) => d.data.name).sort()).toEqual(['Laptop edit', `Phone edit${CONFLICT_SUFFIX}`])
  })

  it('propagates deletes and keeps unsynced edits to a deleted plan', async () => {
    const a = s().createMatch(base('Delete me'))
    const b = s().createMatch(base('Edited'))
    await syncOnce(server.api('alice'))
    on('laptop')
    await syncOnce(server.api('alice'))
    s().deleteSaved(a.id)
    s().deleteSaved(b.id)
    await syncOnce(server.api('alice'))
    expect(server.docs.get(a.id)?.deleted).toBe(true)
    on('phone')
    rename(b.id, 'Edited offline')
    await syncOnce(server.api('alice'))
    expect(names()).toEqual(['Edited offline'])
    expect(s().items[0]!.plan.id).not.toBe(b.id)
  })

  it('re-ids a plan whose id is already taken by someone else', async () => {
    const plan = s().createMatch(base('Mine'))
    server.docs.set(plan.id, { kind: 'match', data: { ...plan, name: 'Theirs' }, version: 1, owner: 'bob', deleted: false })
    await syncOnce(server.api('alice'))
    const newId = s().items[0]!.plan.id
    expect(newId).not.toBe(plan.id)
    expect(hasPendingWork()).toBe(true)
    await syncOnce(server.api('alice'))
    expect(server.docs.get(newId)?.owner).toBe('alice')
    expect(server.docs.get(plan.id)?.data.name).toBe('Theirs')
  })

  it('does not push viewer edits and keeps them as an own copy if pushed', async () => {
    on('bob')
    const plan = s().createMatch(base('Shared'))
    await syncOnce(server.api('bob'))
    server.members.set(`${plan.id}:carol`, 'viewer')
    on('carol')
    await syncOnce(server.api('carol'))
    expect(s().syncMeta[plan.id]?.role).toBe('viewer')
    rename(plan.id, 'Carol edit')
    expect(hasPendingWork()).toBe(false)
    const api = server.api('carol')
    const put = vi.spyOn(api, 'put')
    await syncOnce(api)
    expect(put).not.toHaveBeenCalled()
    expect(server.docs.get(plan.id)?.data.name).toBe('Shared')
  })
})
