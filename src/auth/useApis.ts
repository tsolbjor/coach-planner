import { useAuth } from '@clerk/react'
import { useMemo, useRef } from 'react'
import { createPlansApi, createSharingApi } from '../api/plansApi'

/** API clients bound to the current Clerk session. Only call inside ClerkProvider. */
export function useApis() {
  const { getToken } = useAuth()
  const getTokenRef = useRef(getToken)
  getTokenRef.current = getToken
  return useMemo(() => {
    const token = () => getTokenRef.current()
    return { plans: createPlansApi(token), sharing: createSharingApi(token) }
  }, [])
}
