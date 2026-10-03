import { Show, SignInButton, UserButton } from '@clerk/react'
import { authEnabled } from './config'
import { SyncIndicator } from './SyncIndicator'

export function AccountControls() {
  if (!authEnabled) return null
  return (
    <>
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button
            type="button"
            className="inline-flex min-touch items-center rounded-2xl border border-slate-900 bg-slate-900 px-3 py-2 text-sm font-medium whitespace-nowrap text-white shadow-sm transition-all hover:bg-slate-700"
          >
            Sign in
          </button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <SyncIndicator />
        <span className="inline-flex min-touch items-center px-1">
          <UserButton />
        </span>
      </Show>
    </>
  )
}
