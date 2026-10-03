# Plan: Auth, server-side save, shared plans

Status: draft · 2026-10-03

## Decisions

| Topic | Choice |
|---|---|
| Auth | Clerk (Vercel Marketplace), Google + email magic link |
| DB | Neon Postgres (Vercel Marketplace), Drizzle ORM + migrations |
| API | Vercel Functions in `/api/*.ts` (Node runtime) next to the Vite SPA |
| Sharing | Live shared plans, roles `owner` / `editor` / `viewer`, invite by link or email |
| Data model | Local-first: Zustand/localStorage stays the working copy, syncs to server when signed in |
| Concurrency | Whole-plan documents, optimistic version check (409 on stale write), polling for remote changes |

## Current state (relevant bits)

- Vite + React SPA, `createHashRouter`, PWA via `vite-plugin-pwa`.
- `src/store/savedPlansStore.ts`: `items: SavedItem[]` persisted to localStorage key `coach-saved-plans`; every mutation runs `normalize*` / `regenSlots`.
- Sharing today: `src/utils/shareUrl.ts` packs the whole `MatchPlan` into `#/import?plan=…`; `ImportPage` saves a copy with a new id.
- Plan ids are `nanoid(8)`, generated client-side.

## Data model (Postgres)

```sql
users        (id text pk            -- Clerk user id
             , email text, name text, created_at timestamptz)

plans        (id text pk            -- client-generated nanoid
             , owner_id text references users
             , kind text check (kind in ('match','tournament'))
             , name text
             , data jsonb            -- full MatchPlan / TournamentPlan
             , version int not null default 1
             , created_at, updated_at timestamptz
             , deleted_at timestamptz null)   -- soft delete, purge job later

plan_members (plan_id text references plans on delete cascade
             , user_id text references users
             , role text check (role in ('editor','viewer'))
             , added_at timestamptz
             , primary key (plan_id, user_id))

plan_invites (id text pk
             , plan_id text references plans on delete cascade
             , token_hash text unique        -- sha256 of random 32-byte token
             , role text, email text null     -- null = open link
             , created_by text, expires_at timestamptz
             , max_uses int null, uses int default 0
             , revoked_at timestamptz null)
```

Notes:
- Store the whole plan as `jsonb`. Slots are derived but cheap to keep; client still normalizes on load, so server never needs the scheduler.
- Server validates with zod (shape + size cap ~256 KB) — not full semantic validation.
- Owner is implicit via `plans.owner_id`; `plan_members` holds everyone else.
- New plans should use `nanoid(16)` to make cross-user id collisions negligible. On push, if an id already exists under another owner → server returns 409 `id_taken`, client re-ids the local plan.

## API (`/api`)

All routes require `Authorization: Bearer <Clerk session JWT>`, verified with `@clerk/backend` (`authenticateRequest` / `verifyToken`). Upsert `users` row on first call.

| Method | Route | Purpose | Access |
|---|---|---|---|
| GET | `/api/plans` | list own + shared plans: `{id, kind, name, role, version, updatedAt}` | any user |
| GET | `/api/plans/:id` | full plan + version + role | member |
| PUT | `/api/plans/:id` | create or update; body `{kind, data, baseVersion}`; 409 + current doc if `baseVersion` stale | owner/editor (create: anyone, becomes owner) |
| DELETE | `/api/plans/:id` | soft delete (owner) / leave plan (member) | owner/member |
| GET | `/api/plans/:id/members` | members + pending invites | owner/editor |
| POST | `/api/plans/:id/invites` | create invite `{role, email?, expiresInDays}` → returns link once | owner |
| DELETE | `/api/plans/:id/invites/:inviteId` | revoke | owner |
| PATCH/DELETE | `/api/plans/:id/members/:userId` | change role / remove | owner |
| POST | `/api/invites/accept` | `{token}` → adds membership, returns planId | any user |
| GET | `/api/plans/changes?since=ts` | cheap poll: ids + versions changed since ts | any user |
| DELETE | `/api/me` | delete account + owned plans (GDPR) | self |

Every handler does an explicit membership check in SQL (`where owner_id = $u or exists(member)`); add a shared `requirePlanAccess(planId, userId, minRole)` helper and unit-test it.

## Client changes

1. **Clerk in SPA** — `ClerkProvider` in `main.tsx` (`VITE_CLERK_PUBLISHABLE_KEY`). Sign-in/avatar button in `AppShell`. App fully usable signed out.
2. **API client** — `src/api/client.ts`: `fetch` wrapper attaching `await getToken()`; typed functions per route.
3. **Sync metadata on `SavedItem`** — extend with optional `sync?: { serverVersion: number; dirty: boolean; role: 'owner'|'editor'|'viewer'; ownerName?: string; lastSyncedAt: string }`. Absence = local-only. Bump persisted state with zustand `version` + `migrate`.
4. **Sync engine** — `src/sync/` (pure functions + one hook `useSync()` mounted in `RootLayout`):
   - Store mutations already set `updatedAt`; mark `dirty` in `patchMatch`/`save*` when item has `sync`.
   - Push: debounce ~1.5 s per plan, `PUT` with `baseVersion`. Retry with backoff when offline (`navigator.onLine`, `online` event).
   - Pull: on sign-in, app focus/visibilitychange, and every ~20 s while a plan page is open (poll `/changes`). Fetch changed plans, replace local copy if not dirty.
   - Conflict (409, or remote changed while local dirty): keep it simple v1 — banner "Plan changed by X" with **Load theirs** / **Keep mine as copy**. No field-level merge.
   - Server data passes through `normalizeSavedItem` before entering the store.
5. **First sign-in migration** — dialog: "Upload N plans on this device to your account?" → push each local-only item. Remember choice per user id.
6. **Sign-out** — ask: keep local copies or clear device (important on shared/club devices). Store items must be scoped by user (e.g. persist key `coach-saved-plans:<userId>` / `:anon`) so two accounts on one device don't mix.
7. **Read-only mode** — `PlanPage` + modals get `readOnly` when role is `viewer`: hide edit actions, disable pins/locks. Biggest UI touch; audit `PlanPage.tsx`, `SetupModal`, `PlayersModal`, `SegmentEditor`, `Timeline`.
8. **Share dialog** — replaces/extends current share button: tabs "People" (members, roles, remove) and "Link" (create invite link viewer/editor, revoke). Keep the old URL-encoded "Send a copy" link for signed-out users.
9. **Invite route** — `#/invite/:token` → if signed out, Clerk sign-in then accept → navigate to `/plan/:id`.
10. **HomePage** — "Shared with me" section / badge showing owner and role.

## Infra / config

- Provision via Vercel Marketplace: Clerk + Neon → env vars `CLERK_SECRET_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`, `DATABASE_URL`. `vercel link` + `vercel env pull` locally (repo not linked yet — no `.vercel/`).
- Neon region: EU (Frankfurt) — data is children's names. Use Neon preview branches per Vercel preview deployment.
- Local dev: `vercel dev` (serves `/api` + Vite) or Vite proxy to it.
- PWA: add `navigateFallbackDenylist: [/^\/api\//]`; never runtime-cache `/api`.
- Migrations: `drizzle-kit` generate + migrate step in CI before deploy (or manual for now).
- Rate limiting on `/api/invites/accept` and writes via Vercel Firewall rules.

## Privacy / security

- Plans contain minors' first names + skill levels → personal data under GDPR. Need: short privacy note, account + data deletion (`DELETE /api/me`), EU DB region. Check Clerk data residency and note it.
- Invite tokens: 32 random bytes, only hash stored, expiry default 14 days, revocable.
- Never trust `owner_id`/`role` from client; derive from token + DB.
- Viewer read-only enforced server-side (PUT rejects), UI just mirrors it.

## Phases

| # | Scope | Done when |
|---|---|---|
| 0 | Infra: link Vercel, Clerk + Neon provisioned, Drizzle schema + first migration, `/api/health`, PWA denylist | preview deploy hits DB with authed request |
| 1 | Clerk in SPA, sign in/out UI, per-user store scoping | can sign in on prod, app unchanged otherwise |
| 2 | Plans CRUD API + sync engine + first-login upload | plans follow user across two devices |
| 3 | Sharing: members, invites, accept route, read-only mode, share dialog, shared list | coach B opens invite link, edits/views plan |
| 4 | Live-ish: `/changes` polling, conflict banner | two editors see each other's changes within ~20 s, no silent overwrite |
| 5 | Hardening: account deletion, privacy page, rate limits, soft-delete purge cron | — |

## Testing

- Vitest: sync reducer (dirty/merge/conflict decisions), store migration, `requirePlanAccess`.
- API handler tests against PGlite or a Neon test branch.
- Manual e2e: two browsers/accounts, offline edit then reconnect, viewer cannot write (direct `curl` PUT → 403).

## Open questions

- Should tournament plans share roster *across* plans (team-level roster)? Out of scope here; this plan treats each plan as one document.
- Real-time (SSE/websocket) instead of polling — only if polling feels slow at pitch side.
- Transfer ownership? Probably later.
