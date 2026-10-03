import { useEffect, type ReactNode } from 'react'
import { ClerkProvider, useAuth } from '@clerk/react'
import { setPlanStorageScope } from '../store'
import { clerkPublishableKey } from './config'

/** Keeps the local plans store pointed at the signed-in account. */
function PlanScopeSync() {
  const { isLoaded, userId } = useAuth()
  useEffect(() => {
    // Until Clerk loads (or when offline and it never does) keep the last
    // active scope so the coach still sees their plans.
    if (!isLoaded) return
    void setPlanStorageScope(userId ?? null)
  }, [isLoaded, userId])
  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  if (!clerkPublishableKey) return <>{children}</>
  return (
    <ClerkProvider publishableKey={clerkPublishableKey} afterSignOutUrl="/">
      <PlanScopeSync />
      {children}
    </ClerkProvider>
  )
}
