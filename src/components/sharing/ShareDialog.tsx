import { useCallback, useEffect, useState } from 'react'
import { useAuth, SignInButton } from '@clerk/react'
import type { MatchPlan } from '../../types'
import { useSavedPlansStore } from '../../store'
import { buildShareUrl } from '../../utils/shareUrl'
import { authEnabled } from '../../auth/config'
import { useApis } from '../../auth/useApis'
import { inviteUrl } from '../../api/plansApi'
import type { MemberRole, Person, SharingInfo } from '../../sync/types'
import { Button } from '../common/Button'
import { ModalShell } from '../plan-modals/ModalShell'

interface ShareDialogProps {
  plan: MatchPlan
  onClose: () => void
}

const roleLabel: Record<MemberRole, string> = { editor: 'Can edit', viewer: 'Can view' }

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = (key: string, text: string) =>
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(key)
        setTimeout(() => setCopied((current) => (current === key ? null : current)), 2000)
      })
      .catch(() => alert('Copy failed — try again'))
  return { copied, copy }
}

function displayName(person: Person) {
  return person.name || person.email || 'Unknown coach'
}

function SectionTitle({ children }: { children: string }) {
  return <h3 className="mb-2 text-sm font-semibold text-slate-900">{children}</h3>
}

export function ShareDialog({ plan, onClose }: ShareDialogProps) {
  const { copied, copy } = useCopy()
  return (
    <ModalShell title="Share plan" eyebrow={plan.name} onClose={onClose} maxWidth="md">
      <div className="space-y-6">
        {authEnabled && <LiveSharing planId={plan.id} />}
        <section>
          <SectionTitle>Send a copy</SectionTitle>
          <p className="mb-3 text-sm text-slate-500">
            A link containing a snapshot of this plan. The recipient gets their own copy; later changes are not shared.
          </p>
          <Button size="sm" variant="secondary" onClick={() => copy('snapshot', buildShareUrl(plan))}>
            {copied === 'snapshot' ? 'Copied!' : 'Copy snapshot link'}
          </Button>
        </section>
      </div>
    </ModalShell>
  )
}

function LiveSharing({ planId }: { planId: string }) {
  const { isLoaded, isSignedIn } = useAuth()
  const meta = useSavedPlansStore((s) => s.syncMeta[planId])

  if (!isLoaded) return null
  if (!isSignedIn) {
    return (
      <section>
        <SectionTitle>Share with other coaches</SectionTitle>
        <p className="mb-3 text-sm text-slate-500">Sign in to share a live plan that other coaches can view or edit.</p>
        <SignInButton mode="modal">
          <Button size="sm">Sign in</Button>
        </SignInButton>
      </section>
    )
  }
  if (!meta) {
    return (
      <section>
        <SectionTitle>Share with other coaches</SectionTitle>
        <p className="text-sm text-slate-500">Saving this plan to your account… try again in a moment.</p>
      </section>
    )
  }
  if (meta.role === 'viewer') {
    return (
      <section>
        <SectionTitle>Shared with you</SectionTitle>
        <p className="text-sm text-slate-500">
          {meta.ownerName ?? 'Another coach'} shared this plan with you as view only.
        </p>
      </section>
    )
  }
  return <People planId={planId} isOwner={meta.role === 'owner'} />
}

function People({ planId, isOwner }: { planId: string; isOwner: boolean }) {
  const { sharing } = useApis()
  const { copied, copy } = useCopy()
  const [info, setInfo] = useState<SharingInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [newLink, setNewLink] = useState<{ role: MemberRole; url: string } | null>(null)

  const refresh = useCallback(async () => {
    try {
      setInfo(await sharing.getSharing(planId))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load sharing')
    }
  }, [sharing, planId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await action()
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const createLink = (role: MemberRole) =>
    run(async () => {
      const invite = await sharing.createInvite(planId, role)
      setNewLink({ role, url: inviteUrl(invite.token) })
    })

  const shareLink = (url: string) => {
    if (navigator.share) void navigator.share({ title: 'Coach plan invite', url }).catch(() => {})
    else void copy('new-link', url)
  }

  return (
    <>
      <section>
        <SectionTitle>People with access</SectionTitle>
        {error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {!info && !error && <p className="text-sm text-slate-500">Loading…</p>}
        {info && (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            <li className="flex items-center justify-between gap-3 px-3 py-2">
              <PersonLabel person={info.owner} />
              <span className="shrink-0 text-sm text-slate-500">Owner</span>
            </li>
            {info.members.map((member) => (
              <li key={member.userId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <PersonLabel person={member} />
                {isOwner ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <select
                      aria-label={`Access for ${displayName(member)}`}
                      value={member.role}
                      disabled={busy}
                      onChange={(e) => run(() => sharing.updateMember(planId, member.userId, e.target.value as MemberRole))}
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                    >
                      <option value="editor">{roleLabel.editor}</option>
                      <option value="viewer">{roleLabel.viewer}</option>
                    </select>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        if (confirm(`Remove ${displayName(member)} from this plan?`)) void run(() => sharing.removeMember(planId, member.userId))
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <span className="shrink-0 text-sm text-slate-500">{roleLabel[member.role]}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {isOwner && (
        <section>
          <SectionTitle>Invite with a link</SectionTitle>
          <p className="mb-3 text-sm text-slate-500">
            Anyone who signs in with the link joins this plan. Links expire after 14 days.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => createLink('editor')}>Create edit link</Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => createLink('viewer')}>Create view-only link</Button>
          </div>

          {newLink && (
            <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
              <p className="mb-2 text-sm text-blue-900">
                New {newLink.role === 'editor' ? 'edit' : 'view-only'} link. Copy it now — it can’t be shown again.
              </p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={newLink.url}
                  onFocus={(e) => e.currentTarget.select()}
                  className="min-w-0 flex-1 rounded-lg border border-blue-200 bg-white px-2 py-1.5 text-sm text-slate-700"
                />
                <Button size="sm" onClick={() => copy('new-link', newLink.url)}>{copied === 'new-link' ? 'Copied!' : 'Copy'}</Button>
                {'share' in navigator && (
                  <Button size="sm" variant="secondary" onClick={() => shareLink(newLink.url)}>Share…</Button>
                )}
              </div>
            </div>
          )}

          {info && info.invites.length > 0 && (
            <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
              {info.invites.map((invite) => (
                <li key={invite.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="text-slate-700">
                    {roleLabel[invite.role]} link · expires {new Date(invite.expiresAt).toLocaleDateString()} · used {invite.uses}×
                  </span>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => sharing.revokeInvite(planId, invite.id))}>
                    Revoke
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  )
}

function PersonLabel({ person }: { person: Person }) {
  return (
    <span className="min-w-0">
      <span className="block truncate text-sm font-medium text-slate-900">{displayName(person)}</span>
      {person.name && person.email && <span className="block truncate text-xs text-slate-500">{person.email}</span>}
    </span>
  )
}
