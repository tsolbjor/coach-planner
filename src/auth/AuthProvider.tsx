import { useEffect, useRef, type ReactNode } from 'react'
import { ClerkProvider, useAuth } from '@clerk/react'
import { createPlansApi } from '../api/plansApi'
import { setPlanStorageScope } from '../store'
import { startSync } from '../sync/engine'
import { clerkPublishableKey } from './config'

/** Points the local plans store at the signed-in account and syncs it with the server. */
function PlanSync() {
  const { isLoaded, userId, getToken } = useAuth()
  const getTokenRef = useRef(getToken)
  getTokenRef.current = getToken

  useEffect(() => {
    // Until Clerk loads (or when offline and it never does) keep the last
    // active scope so the coach still sees their plans.
    if (!isLoaded) return
    let cancelled = false
    let stop: (() => void) | undefined
    void setPlanStorageScope(userId ?? null).then(() => {
      if (cancelled || !userId) return
      stop = startSync(createPlansApi(() => getTokenRef.current())).stop
    })
    return () => {
      cancelled = true
      stop?.()
    }
  }, [isLoaded, userId])
  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  if (!clerkPublishableKey) return <>{children}</>
  return (
    <ClerkProvider publishableKey={clerkPublishableKey} afterSignOutUrl="/">
      <PlanSync />
      {children}
    </ClerkProvider>
  )
}
