import { sql } from 'drizzle-orm'
import { check, index, integer, jsonb, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core'

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()

/** Mirror of Clerk users, upserted on first authenticated request. */
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email'),
  name: text('name'),
  createdAt: createdAt(),
})

/** One plan document (MatchPlan or TournamentPlan) stored whole. */
export const plans = pgTable('plans', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull().references(() => users.id),
  kind: text('kind', { enum: ['match', 'tournament'] }).notNull(),
  name: text('name').notNull(),
  data: jsonb('data').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: createdAt(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  check('plans_kind_check', sql`${t.kind} in ('match', 'tournament')`),
  index('plans_owner_idx').on(t.ownerId),
  index('plans_updated_idx').on(t.updatedAt),
])

/** Non-owner access to a plan. The owner is implicit via plans.owner_id. */
export const planMembers = pgTable('plan_members', {
  planId: text('plan_id').notNull().references(() => plans.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['editor', 'viewer'] }).notNull(),
  addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.planId, t.userId] }),
  check('plan_members_role_check', sql`${t.role} in ('editor', 'viewer')`),
  index('plan_members_user_idx').on(t.userId),
])

/** Invite links. Only a SHA-256 hash of the token is stored. */
export const planInvites = pgTable('plan_invites', {
  id: text('id').primaryKey(),
  planId: text('plan_id').notNull().references(() => plans.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  role: text('role', { enum: ['editor', 'viewer'] }).notNull(),
  /** Null means anyone with the link may accept. */
  email: text('email'),
  createdBy: text('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: createdAt(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  maxUses: integer('max_uses'),
  uses: integer('uses').notNull().default(0),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, (t) => [
  check('plan_invites_role_check', sql`${t.role} in ('editor', 'viewer')`),
  index('plan_invites_plan_idx').on(t.planId),
])
