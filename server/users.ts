import { createClerkClient } from '@clerk/backend'
import { eq } from 'drizzle-orm'
import type { Db } from './db/client.js'
import { users } from './db/schema.js'

export interface UserProfile {
  email: string | null
  name: string | null
}

type ProfileFetcher = (userId: string) => Promise<UserProfile>

const clerkProfile: ProfileFetcher = async (userId) => {
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) return { email: null, name: null }
  const user = await createClerkClient({ secretKey }).users.getUser(userId)
  const email = user.primaryEmailAddress?.emailAddress ?? null
  return { email, name: user.fullName ?? user.username ?? email }
}

let fetchProfile: ProfileFetcher = clerkProfile

/** Test hook: replace the Clerk profile lookup. */
export function setProfileFetcher(fetcher: ProfileFetcher | undefined): void {
  fetchProfile = fetcher ?? clerkProfile
}

/**
 * Make sure the caller has a users row with a display name, so other plan
 * members can see who they share with. Clerk is only asked when the profile is missing.
 */
export async function ensureUser(db: Db, userId: string): Promise<void> {
  const [existing] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId))
  if (existing?.email) return
  let profile: UserProfile = { email: null, name: null }
  try {
    profile = await fetchProfile(userId)
  } catch (error) {
    // A profile is cosmetic; never block saving or sharing on it.
    console.warn('Could not load Clerk profile', error)
  }
  await db
    .insert(users)
    .values({ id: userId, ...profile })
    .onConflictDoUpdate({ target: users.id, set: profile })
}
