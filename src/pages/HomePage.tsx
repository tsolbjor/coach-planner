import { useNavigate } from 'react-router-dom'
import { useSavedPlansStore, useMatchStore, useRosterStore, useSettingsStore } from '../store'
import { Button } from '../components/common/Button'
import { Card } from '../components/common/Card'
import type { SavedItem } from '../types'

function SavedItemRow({ item, onLoad, onDelete }: { item: SavedItem; onLoad: () => void; onDelete: () => void }) {
  const plan = item.kind === 'match' ? item.plan : item.plan
  const date = new Date(plan.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{plan.name}</p>
        <p className="text-xs text-slate-500">
          {item.kind === 'match' ? 'Match' : 'Tournament'} · {plan.sportConfig.name} · {date}
        </p>
      </div>
      <button onClick={onLoad} className="text-blue-600 text-sm font-medium px-2 py-1 rounded-lg hover:bg-blue-50 min-touch flex items-center">
        Load
      </button>
      <button onClick={onDelete} className="text-red-400 text-sm px-2 py-1 rounded-lg hover:bg-red-50 min-touch flex items-center">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  )
}

export function HomePage() {
  const navigate = useNavigate()
  const { items, deleteSaved } = useSavedPlansStore()
  const { setPlan } = useMatchStore()
  const { players } = useRosterStore()
  const { sportConfig } = useSettingsStore()

  const handleLoad = (item: SavedItem) => {
    if (item.kind === 'match') {
      setPlan(item.plan)
      navigate('/plan')
    }
  }

  return (
    <div className="px-4 pt-8 pb-12 max-w-lg mx-auto space-y-6">
      {/* Logo / title */}
      <div className="text-center py-4">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-3">
          <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold">Coach Planner</h1>
        <p className="text-slate-500 text-sm mt-1">Plan your kids' team rotations</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-2xl font-bold text-blue-600">{players.length}</p>
          <p className="text-sm text-slate-500">Players in roster</p>
        </Card>
        <Card>
          <p className="text-2xl font-bold text-blue-600">{sportConfig.name.split(' ')[0]}</p>
          <p className="text-sm text-slate-500">Current sport</p>
        </Card>
      </div>

      {/* New match */}
      <div className="space-y-2">
        <Button fullWidth size="lg" onClick={() => navigate('/setup')}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New match plan
        </Button>
        <Button fullWidth variant="secondary" onClick={() => navigate('/roster')}>
          Manage roster
        </Button>
      </div>

      {/* Saved plans */}
      {items.length > 0 && (
        <Card padding={false}>
          <div className="px-4 pt-3 pb-1">
            <h2 className="font-semibold text-sm text-slate-700">Saved plans</h2>
          </div>
          <div className="px-4">
            {items.map((item) => (
              <SavedItemRow
                key={item.kind === 'match' ? item.plan.id : item.plan.id}
                item={item}
                onLoad={() => handleLoad(item)}
                onDelete={() => deleteSaved(item.kind === 'match' ? item.plan.id : item.plan.id)}
              />
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
