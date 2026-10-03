import { useSyncStatus, type SyncState } from '../sync/engine'

const labels: Record<SyncState, { text: string; dot: string }> = {
  idle: { text: 'Saved to account', dot: 'bg-emerald-500' },
  syncing: { text: 'Syncing…', dot: 'bg-blue-500 animate-pulse' },
  offline: { text: 'Offline – changes kept on this device', dot: 'bg-amber-500' },
  error: { text: 'Some plans could not be synced', dot: 'bg-red-500' },
}

export function SyncIndicator() {
  const state = useSyncStatus((s) => s.state)
  const { text, dot } = labels[state]
  return (
    <span className="inline-flex items-center px-1" title={text} role="status" aria-label={text}>
      <span className={['h-2.5 w-2.5 rounded-full', dot].join(' ')} />
    </span>
  )
}
