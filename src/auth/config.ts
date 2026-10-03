/**
 * Clerk publishable key. The Vercel Marketplace integration provisions it as
 * NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY; VITE_ takes precedence when set locally.
 * Without a key the app runs signed-out only.
 */
export const clerkPublishableKey: string | undefined =
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || undefined

export const authEnabled = !!clerkPublishableKey
