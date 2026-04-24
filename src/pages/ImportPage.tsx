import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { nanoid } from 'nanoid'
import { useSavedPlansStore } from '../store'
import { decodePlan } from '../utils/shareUrl'
import { AppShell } from '../components/common/AppShell'
import { Button } from '../components/common/Button'
import { buildTopFlowItems } from '../components/common/TopFlowNav'

export function ImportPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { saveMatch } = useSavedPlansStore()
  const [error, setError] = useState<string | null>(null)
  const imported = useRef(false)

  useEffect(() => {
    if (imported.current) return
    imported.current = true

    const encoded = searchParams.get('plan')
    if (!encoded) {
      setError('No plan data in link.')
      return
    }

    const plan = decodePlan(encoded)
    if (!plan) {
      setError('Link is invalid or corrupted.')
      return
    }

    const now = new Date().toISOString()
    const newPlan = { ...plan, id: nanoid(8), createdAt: now, updatedAt: now }
    saveMatch(newPlan)
    navigate(`/plan/${newPlan.id}`, { replace: true })
  }, [])

  if (error) {
    return (
      <AppShell flowItems={buildTopFlowItems()} width="default">
        <div className="mx-auto max-w-lg pt-12 text-center text-slate-500">
          <p className="mb-4">{error}</p>
          <Button onClick={() => navigate('/')}>Go home</Button>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell flowItems={buildTopFlowItems()} width="default">
      <div className="mx-auto max-w-lg pt-12 text-center text-slate-400">
        <p>Importing plan…</p>
      </div>
    </AppShell>
  )
}
