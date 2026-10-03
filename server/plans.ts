import { and, eq, isNull, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { Db } from './db/client.js'
import { planMembers, plans, users } from './db/schema.js'
import { HttpError } from './auth.js'
import { ensureUser } from './users.js'

export type PlanRole = 'owner' | 'editor' | 'viewer'
export type PlanKind = 'match' | 'tournament'

export interface PlanSummary {
  id: string
  kind: PlanKind
  name: string
  version: number
  role: PlanRole
  /** Display name of the owner, for plans shared with the caller. */
  ownerName: string | null
  updatedAt: string
}

export interface PlanDocument extends PlanSummary {
  data: unknown
}

/** Plans are a few KB; anything far larger is a bug or abuse. */
export const MAX_PLAN_BYTES = 512 * 1024

export const planIdSchema = z.string().regex(/^[A-Za-z0-9_-]{6,64}$/)

export const putPlanBody = z.object({
  kind: z.enum(['match', 'tournament']),
  /** 0 when creating; otherwise the version the client last saw. */
  baseVersion: z.number().int().min(0),
  data: z.looseObject({ id: z.string(), name: z.string().max(200) }),
})
export type PutPlanBody = z.infer<typeof putPlanBody>

export function canWrite(role: PlanRole | null): boolean {
  return role === 'owner' || role === 'editor'
}

function roleOf(ownerId: string, memberRole: 'editor' | 'viewer' | null, userId: string): PlanRole | null {
  return ownerId === userId ? 'owner' : memberRole
}

const iso = (d: Date) => d.toISOString()

/** Load a plan row (deleted or not) with the caller's role, or null when no such id exists. */
export async function loadRow(db: Db, planId: string, userId: string) {
  const [row] = await db
    .select({
      id: plans.id,
      ownerId: plans.ownerId,
      kind: plans.kind,
      name: plans.name,
      data: plans.data,
      version: plans.version,
      updatedAt: plans.updatedAt,
      deletedAt: plans.deletedAt,
      memberRole: planMembers.role,
      ownerName: users.name,
    })
    .from(plans)
    .leftJoin(planMembers, and(eq(planMembers.planId, plans.id), eq(planMembers.userId, userId)))
    .leftJoin(users, eq(users.id, plans.ownerId))
    .where(eq(plans.id, planId))
  if (!row) return null
  return { ...row, role: roleOf(row.ownerId, row.memberRole, userId) }
}

function toDocument(row: NonNullable<Awaited<ReturnType<typeof loadRow>>>): PlanDocument {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    version: row.version,
    role: row.role!,
    ownerName: row.ownerName,
    updatedAt: iso(row.updatedAt),
    data: row.data,
  }
}

export async function listPlans(db: Db, userId: string): Promise<PlanSummary[]> {
  const rows = await db
    .select({
      id: plans.id,
      ownerId: plans.ownerId,
      kind: plans.kind,
      name: plans.name,
      version: plans.version,
      updatedAt: plans.updatedAt,
      memberRole: planMembers.role,
      ownerName: users.name,
    })
    .from(plans)
    .leftJoin(planMembers, and(eq(planMembers.planId, plans.id), eq(planMembers.userId, userId)))
    .leftJoin(users, eq(users.id, plans.ownerId))
    .where(and(isNull(plans.deletedAt), or(eq(plans.ownerId, userId), eq(planMembers.userId, userId))))
    .orderBy(plans.updatedAt)
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    name: row.name,
    version: row.version,
    role: roleOf(row.ownerId, row.memberRole, userId)!,
    ownerName: row.ownerName,
    updatedAt: iso(row.updatedAt),
  }))
}

export async function getPlan(db: Db, planId: string, userId: string): Promise<PlanDocument> {
  const row = await loadRow(db, planId, userId)
  // Do not reveal whether an inaccessible id exists.
  if (!row || !row.role || row.deletedAt) throw new HttpError(404, 'Plan not found')
  return toDocument(row)
}

export type PutResult =
  | { status: 'created' | 'updated'; version: number; updatedAt: string }
  | { status: 'conflict'; current: PlanDocument }

export async function putPlan(db: Db, planId: string, userId: string, body: PutPlanBody): Promise<PutResult> {
  if (body.data.id !== planId) throw new HttpError(400, 'Plan id mismatch')
  const row = await loadRow(db, planId, userId)

  if (!row) {
    if (body.baseVersion !== 0) throw new HttpError(410, 'Plan was deleted')
    await ensureUser(db, userId)
    const [created] = await db
      .insert(plans)
      .values({ id: planId, ownerId: userId, kind: body.kind, name: body.data.name, data: body.data })
      .onConflictDoNothing()
      .returning({ version: plans.version, updatedAt: plans.updatedAt })
    // Lost a create race on the same id; let the client retry against the stored row.
    if (!created) throw new HttpError(409, 'Plan id already exists')
    return { status: 'created', version: created.version, updatedAt: iso(created.updatedAt) }
  }

  if (!row.role) {
    // Someone else's id: on create the client re-ids; otherwise access was removed.
    if (body.baseVersion === 0) throw new HttpError(409, 'Plan id already exists')
    throw new HttpError(404, 'Plan not found')
  }
  if (row.deletedAt) throw new HttpError(410, 'Plan was deleted')
  if (!canWrite(row.role)) throw new HttpError(403, 'Read-only access')
  if (row.kind !== body.kind) throw new HttpError(400, 'Plan kind cannot change')

  const [updated] = await db
    .update(plans)
    .set({ data: body.data, name: body.data.name, version: sql`${plans.version} + 1`, updatedAt: sql`now()` })
    .where(and(eq(plans.id, planId), eq(plans.version, body.baseVersion), isNull(plans.deletedAt)))
    .returning({ version: plans.version, updatedAt: plans.updatedAt })
  if (updated) return { status: 'updated', version: updated.version, updatedAt: iso(updated.updatedAt) }

  const current = await loadRow(db, planId, userId)
  if (!current || current.deletedAt) throw new HttpError(410, 'Plan was deleted')
  return { status: 'conflict', current: toDocument(current) }
}

/** Owner soft-deletes the plan; a member leaves it. */
export async function deletePlan(db: Db, planId: string, userId: string): Promise<void> {
  const row = await loadRow(db, planId, userId)
  if (!row || !row.role || row.deletedAt) throw new HttpError(404, 'Plan not found')
  if (row.role === 'owner') {
    await db.update(plans).set({ deletedAt: sql`now()` }).where(eq(plans.id, planId))
  } else {
    await db.delete(planMembers).where(and(eq(planMembers.planId, planId), eq(planMembers.userId, userId)))
  }
}
