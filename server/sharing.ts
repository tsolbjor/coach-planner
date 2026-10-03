import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { and, eq, gt, isNull, lt, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { HttpError } from './auth.js'
import type { Db } from './db/client.js'
import { planInvites, planMembers, plans, users } from './db/schema.js'
import { loadRow, type PlanRole } from './plans.js'
import { ensureUser } from './users.js'

export type MemberRole = 'editor' | 'viewer'

export const memberRoleSchema = z.enum(['editor', 'viewer'])
export const createInviteBody = z.object({
  role: memberRoleSchema,
  expiresInDays: z.number().int().min(1).max(90).default(14),
})
export const acceptInviteBody = z.object({ token: z.string().min(20).max(200) })
export const updateMemberBody = z.object({ role: memberRoleSchema })

export interface Person {
  userId: string
  name: string | null
  email: string | null
}

export interface SharingInfo {
  owner: Person
  members: (Person & { role: MemberRole })[]
  /** Active invite links (owner only; empty for editors). */
  invites: { id: string; role: MemberRole; expiresAt: string; uses: number }[]
}

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

/** Resolve the caller's role on a live plan or fail without revealing whether it exists. */
async function requireRole(db: Db, planId: string, userId: string, allowed: PlanRole[]) {
  const row = await loadRow(db, planId, userId)
  if (!row || !row.role || row.deletedAt) throw new HttpError(404, 'Plan not found')
  if (!allowed.includes(row.role)) throw new HttpError(403, 'Not allowed')
  return row
}

export async function getSharing(db: Db, planId: string, userId: string): Promise<SharingInfo> {
  const row = await requireRole(db, planId, userId, ['owner', 'editor'])
  await ensureUser(db, userId)
  const [owner] = await db.select({ userId: users.id, name: users.name, email: users.email }).from(users).where(eq(users.id, row.ownerId))
  const members = await db
    .select({ userId: users.id, name: users.name, email: users.email, role: planMembers.role })
    .from(planMembers)
    .innerJoin(users, eq(users.id, planMembers.userId))
    .where(eq(planMembers.planId, planId))
    .orderBy(planMembers.addedAt)
  const invites = row.role !== 'owner' ? [] : await db
    .select({ id: planInvites.id, role: planInvites.role, expiresAt: planInvites.expiresAt, uses: planInvites.uses })
    .from(planInvites)
    .where(and(eq(planInvites.planId, planId), isNull(planInvites.revokedAt), gt(planInvites.expiresAt, sql`now()`)))
    .orderBy(planInvites.createdAt)
  return {
    owner: owner ?? { userId: row.ownerId, name: null, email: null },
    members,
    invites: invites.map((i) => ({ ...i, expiresAt: i.expiresAt.toISOString() })),
  }
}

export async function createInvite(db: Db, planId: string, userId: string, body: z.infer<typeof createInviteBody>) {
  await requireRole(db, planId, userId, ['owner'])
  await ensureUser(db, userId)
  // The raw token only ever exists in the link; the database keeps its hash.
  const token = randomBytes(32).toString('base64url')
  const [invite] = await db
    .insert(planInvites)
    .values({
      id: randomUUID(),
      planId,
      tokenHash: hashToken(token),
      role: body.role,
      createdBy: userId,
      expiresAt: sql`now() + make_interval(days => ${body.expiresInDays})`,
    })
    .returning({ id: planInvites.id, role: planInvites.role, expiresAt: planInvites.expiresAt, uses: planInvites.uses })
  return { ...invite!, expiresAt: invite!.expiresAt.toISOString(), token }
}

export async function revokeInvite(db: Db, planId: string, inviteId: string, userId: string): Promise<void> {
  await requireRole(db, planId, userId, ['owner'])
  const revoked = await db
    .update(planInvites)
    .set({ revokedAt: sql`now()` })
    .where(and(eq(planInvites.id, inviteId), eq(planInvites.planId, planId), isNull(planInvites.revokedAt)))
    .returning({ id: planInvites.id })
  if (!revoked.length) throw new HttpError(404, 'Invite not found')
}

export async function updateMember(db: Db, planId: string, memberId: string, userId: string, role: MemberRole) {
  await requireRole(db, planId, userId, ['owner'])
  const updated = await db
    .update(planMembers)
    .set({ role })
    .where(and(eq(planMembers.planId, planId), eq(planMembers.userId, memberId)))
    .returning({ userId: planMembers.userId })
  if (!updated.length) throw new HttpError(404, 'Member not found')
}

export async function removeMember(db: Db, planId: string, memberId: string, userId: string) {
  await requireRole(db, planId, userId, ['owner'])
  const removed = await db
    .delete(planMembers)
    .where(and(eq(planMembers.planId, planId), eq(planMembers.userId, memberId)))
    .returning({ userId: planMembers.userId })
  if (!removed.length) throw new HttpError(404, 'Member not found')
}

const INVALID_INVITE = 'This invite link is invalid or has expired'

/** Join a plan through an invite link. Never downgrades an existing membership. */
export async function acceptInvite(db: Db, token: string, userId: string): Promise<{ planId: string; role: PlanRole }> {
  const [invite] = await db
    .select({ id: planInvites.id, planId: planInvites.planId, role: planInvites.role, ownerId: plans.ownerId })
    .from(planInvites)
    .innerJoin(plans, eq(plans.id, planInvites.planId))
    .where(and(
      eq(planInvites.tokenHash, hashToken(token)),
      isNull(planInvites.revokedAt),
      gt(planInvites.expiresAt, sql`now()`),
      isNull(plans.deletedAt),
    ))
  if (!invite) throw new HttpError(404, INVALID_INVITE)
  if (invite.ownerId === userId) return { planId: invite.planId, role: 'owner' }

  const used = await db
    .update(planInvites)
    .set({ uses: sql`${planInvites.uses} + 1` })
    .where(and(eq(planInvites.id, invite.id), or(isNull(planInvites.maxUses), lt(planInvites.uses, planInvites.maxUses))))
    .returning({ id: planInvites.id })
  if (!used.length) throw new HttpError(404, INVALID_INVITE)

  await ensureUser(db, userId)
  const [member] = await db
    .insert(planMembers)
    .values({ planId: invite.planId, userId, role: invite.role })
    .onConflictDoUpdate({
      target: [planMembers.planId, planMembers.userId],
      set: { role: sql`case when excluded.role = 'editor' then 'editor' else ${planMembers.role} end` },
    })
    .returning({ role: planMembers.role })
  return { planId: invite.planId, role: member!.role }
}
