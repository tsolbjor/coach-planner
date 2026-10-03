import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { SignInButton, useAuth } from '@clerk/react'
import { authEnabled } from '../auth/config'
import { useApis } from '../auth/useApis'
import { useSavedPlansStore, whenPlanScopeSettled } from '../store'
import { AppShell } from '../components/common/AppShell'
import { Button } from '../components/common/Button'
import { Card } from '../components/common/Card'
import { buildTopFlowItems } from '../components/common/TopFlowNav'

function InviteLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell flowItems={buildTopFlowItems()} width="default">
      <Card className="mx-auto mt-12 max-w-md text-center">{children}</Card>
    </AppShell>
  )
}

export function InvitePage() {
  if (!authEnabled) {
    return (
      <InviteLayout>
        <p className="text-slate-600">Sign-in is not available in this version of the app, so invites cannot be accepted.</p>
      </InviteLayout>
    )
  }
  return <AcceptInvite />
}

function AcceptInvite() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { isLoaded, isSignedIn, userId } = useAuth()
  const { plans, sharing } = useApis()
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !token || started.current) return
    started.current = true
    void (async () => {
      try {
        const { planId } = await sharing.acceptInvite(token)
        const doc = await plans.get(planId)
        // Signing in on this page switches the local store to the account;
        // add the plan only after that has finished so it is not overwritten.
        await whenPlanScopeSettled()
        if (doc) useSavedPlansStore.getState().applyRemote(doc)
        navigate(`/plan/${planId}`, { replace: true })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not accept the invite')
      }
    })()
  }, [isLoaded, isSignedIn, token, userId, plans, sharing, navigate])

  if (!isLoaded) return <InviteLayout><p className="text-slate-500">Loading…</p></InviteLayout>

  if (!isSignedIn) {
    return (
      <InviteLayout>
        <h1 className="mb-2 text-xl font-bold text-slate-900">You’ve been invited to a plan</h1>
        <p className="mb-5 text-slate-600">Sign in or create an account to open the shared plan.</p>
        <SignInButton mode="modal">
          <Button>Sign in to continue</Button>
        </SignInButton>
      </InviteLayout>
    )
  }

  if (error) {
    return (
      <InviteLayout>
        <p className="mb-4 text-slate-700">{error}</p>
        <Button onClick={() => navigate('/')}>Go home</Button>
      </InviteLayout>
    )
  }

  return <InviteLayout><p className="text-slate-500">Joining plan…</p></InviteLayout>
}
