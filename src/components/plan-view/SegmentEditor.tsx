import { useState } from 'react'
import type { Player, SegmentPin, TimeSlot } from '../../types'
import { Button } from '../common/Button'

interface SegmentEditorProps {
  slots: TimeSlot[]
  segmentIndex: number
  selectedPlayerId: string
  players: Player[]
  pins: Record<number, SegmentPin>
  totalOnField: number
  interactionMode?: 'plan' | 'in-game'
  onClose: () => void
  onSetPins: (updates: Record<number, SegmentPin | null>) => void
}

type CellRole = 'gk' | 'field' | 'bench' | 'absent' | 'absent-credited'

function roleOf(slot: TimeSlot, playerId: string): CellRole | 'unknown' {
  if (slot.gkId === playerId) return 'gk'
  if (slot.fieldIds.includes(playerId)) return 'field'
  if (slot.benchIds.includes(playerId)) return 'bench'
  if (slot.absentCreditedIds.includes(playerId)) return 'absent-credited'
  if (slot.absentIds.includes(playerId)) return 'absent'
  return 'unknown'
}

function clearPlayerConstraints(existing: SegmentPin | undefined, playerIds: string[]): SegmentPin {
  const next: SegmentPin = { ...existing }
  // Preserve existing positive constraints without turning a two-player edit into
  // an exact snapshot of the rest of the automatically generated lineup.
  const fields = [...new Set([...(next.fieldIds ?? []), ...(next.requiredFieldIds ?? [])])]
  const bench = [...new Set([...(next.benchIds ?? []), ...(next.requiredBenchIds ?? [])])]
  delete next.fieldIds
  delete next.benchIds
  next.requiredFieldIds = fields
  next.requiredBenchIds = bench
  for (const key of ['requiredFieldIds', 'requiredBenchIds', 'absentIds', 'absentCreditedIds'] as const) {
    if (next[key]) {
      next[key] = next[key]!.filter((id) => !playerIds.includes(id))
      if (!next[key]!.length) delete next[key]
    }
  }
  if (next.gkId && playerIds.includes(next.gkId)) delete next.gkId
  return next
}

function swap(slot: TimeSlot, existing: SegmentPin | undefined, a: string, b: string): SegmentPin {
  const next = clearPlayerConstraints(existing, [a, b])
  const setRole = (player: string, role: CellRole | 'unknown') => {
    if (role === 'gk') next.gkId = player
    const key = role === 'field' ? 'requiredFieldIds'
      : role === 'bench' ? 'requiredBenchIds'
        : role === 'absent' ? 'absentIds'
          : role === 'absent-credited' ? 'absentCreditedIds' : null
    if (key) next[key] = [...new Set([...(next[key] ?? []), player])]
  }
  setRole(a, roleOf(slot, b))
  setRole(b, roleOf(slot, a))
  return next
}

function isOnFieldRole(role: CellRole | 'unknown'): role is 'gk' | 'field' {
  return role === 'gk' || role === 'field'
}

function keepPlayerBenched(existing: SegmentPin | undefined, playerId: string): SegmentPin {
  const next = clearPlayerConstraints(existing, [playerId])
  next.requiredBenchIds = [...new Set([...(next.requiredBenchIds ?? []), playerId])]
  return next
}

export function buildSwapPinUpdates(args: {
  slots: TimeSlot[]
  pins: Record<number, SegmentPin>
  segmentIndex: number
  selectedPlayerId: string
  otherPlayerId: string
  interactionMode?: 'plan' | 'in-game'
}): Record<number, SegmentPin | null> {
  const {
    slots,
    pins,
    segmentIndex,
    selectedPlayerId,
    otherPlayerId,
    interactionMode = 'plan',
  } = args
  const slot = slots[segmentIndex]
  if (!slot || otherPlayerId === selectedPlayerId) return {}

  const updates: Record<number, SegmentPin | null> = {
    [segmentIndex]: swap(slot, pins[segmentIndex], selectedPlayerId, otherPlayerId),
  }
  if (interactionMode !== 'in-game') return updates

  const selectedRole = roleOf(slot, selectedPlayerId)
  const otherRole = roleOf(slot, otherPlayerId)
  const subbedOffId = isOnFieldRole(selectedRole)
    ? selectedPlayerId
    : isOnFieldRole(otherRole)
      ? otherPlayerId
      : null
  const subbedOnId = selectedRole === 'bench' ? selectedPlayerId : otherRole === 'bench' ? otherPlayerId : null
  if (!subbedOffId || !subbedOnId) return updates

  const nextSlot = slots[segmentIndex + 1]
  if (!nextSlot || nextSlot.matchIndex !== slot.matchIndex || nextSlot.periodIndex !== slot.periodIndex) {
    return updates
  }

  updates[segmentIndex + 1] = keepPlayerBenched(pins[segmentIndex + 1], subbedOffId)
  return updates
}

export function applyAbsence(existing: SegmentPin | undefined, playerId: string, credit: boolean): SegmentPin {
  const base = clearPlayerConstraints(existing, [playerId])
  const absent = new Set(base.absentIds ?? [])
  const credited = new Set(base.absentCreditedIds ?? [])
  if (credit) {
    credited.add(playerId)
    absent.delete(playerId)
  } else {
    absent.add(playerId)
    credited.delete(playerId)
  }
  return {
    ...base,
    absentIds: [...absent],
    absentCreditedIds: [...credited],
  }
}

export function applyPresence(existing: SegmentPin | undefined, playerId: string): SegmentPin | null {
  const base = existing ?? {}
  const absent = (base.absentIds ?? []).filter((id) => id !== playerId)
  const credited = (base.absentCreditedIds ?? []).filter((id) => id !== playerId)
  const next: SegmentPin = { ...base, absentIds: absent, absentCreditedIds: credited }
  if (next.absentIds!.length === 0) delete next.absentIds
  if (next.absentCreditedIds!.length === 0) delete next.absentCreditedIds
  const empty =
    next.gkId === undefined &&
    next.fieldIds === undefined &&
    next.benchIds === undefined &&
    next.requiredFieldIds === undefined &&
    next.requiredBenchIds === undefined &&
    next.absentIds === undefined &&
    next.absentCreditedIds === undefined
  return empty ? null : next
}

function scopeSegments(
  slots: TimeSlot[],
  fromIndex: number,
  scope: 'segment' | 'period' | 'match',
): number[] {
  if (scope === 'segment') return [fromIndex]
  const anchor = slots[fromIndex]
  if (!anchor) return [fromIndex]
  const out: number[] = []
  for (let i = fromIndex; i < slots.length; i++) {
    const s = slots[i]!
    if (s.matchIndex !== anchor.matchIndex) break
    if (scope === 'period' && s.periodIndex !== anchor.periodIndex) break
    out.push(i)
  }
  return out
}

export function SegmentEditor({
  slots,
  segmentIndex,
  selectedPlayerId,
  players,
  pins,
  totalOnField,
  interactionMode = 'plan',
  onClose,
  onSetPins,
}: SegmentEditorProps) {
  const [credit, setCredit] = useState(false)
  const slot = slots[segmentIndex]!
  const playerById = new Map(players.map((p) => [p.id, p]))
  const selected = playerById.get(selectedPlayerId)
  const selectedRole = roleOf(slot, selectedPlayerId)
  const isAbsent = selectedRole === 'absent' || selectedRole === 'absent-credited'

  const gkPlayer = slot.gkId ? playerById.get(slot.gkId) : null
  const fieldPlayers = slot.fieldIds.map((id) => playerById.get(id)).filter((p): p is Player => !!p)
  const benchPlayers = slot.benchIds.map((id) => playerById.get(id)).filter((p): p is Player => !!p)
  const absentPlayers = [...slot.absentIds, ...slot.absentCreditedIds]
    .map((id) => playerById.get(id))
    .filter((p): p is Player => !!p)

  const hasPinHere = pins[segmentIndex] !== undefined

  const handleSwap = (otherId: string) => {
    if (otherId === selectedPlayerId) return
    onSetPins(
      buildSwapPinUpdates({
        slots,
        pins,
        segmentIndex,
        selectedPlayerId,
        otherPlayerId: otherId,
        interactionMode,
      }),
    )
    onClose()
  }

  const handleMarkAbsent = (scope: 'segment' | 'period' | 'match') => {
    const targets = scopeSegments(slots, segmentIndex, scope)
    const updates: Record<number, SegmentPin | null> = {}
    for (const idx of targets) {
      updates[idx] = applyAbsence(pins[idx], selectedPlayerId, credit)
    }
    onSetPins(updates)
    onClose()
  }

  const handleMarkPresent = (scope: 'segment' | 'period' | 'match') => {
    const targets = scopeSegments(slots, segmentIndex, scope)
    const updates: Record<number, SegmentPin | null> = {}
    for (const idx of targets) {
      updates[idx] = applyPresence(pins[idx], selectedPlayerId)
    }
    onSetPins(updates)
    onClose()
  }

  const handleClearPin = () => {
    onSetPins({ [segmentIndex]: null })
    onClose()
  }

  const minActiveAfterAbsence = (scope: 'segment' | 'period' | 'match'): number => {
    if (isAbsent) return players.length
    const targets = scopeSegments(slots, segmentIndex, scope)
    let worst = players.length
    for (const idx of targets) {
      const s = slots[idx]
      if (!s) continue
      const already = new Set([...s.absentIds, ...s.absentCreditedIds])
      const after = already.has(selectedPlayerId) ? already.size : already.size + 1
      const active = players.length - after
      if (active < worst) worst = active
    }
    return worst
  }

  const scopeTooFew: Record<'segment' | 'period' | 'match', boolean> = {
    segment: !isAbsent && minActiveAfterAbsence('segment') < totalOnField,
    period: !isAbsent && minActiveAfterAbsence('period') < totalOnField,
    match: !isAbsent && minActiveAfterAbsence('match') < totalOnField,
  }
  const anyTooFew = scopeTooFew.segment || scopeTooFew.period || scopeTooFew.match

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/30 p-3 backdrop-blur-sm sm:items-center">
      <div className="flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">
              Segment · {Math.floor(slot.startMinute)}'–{Math.ceil(slot.endMinute)}'
            </p>
            <h3 className="mt-0.5 text-base font-bold text-slate-900">
              {selected?.name ?? 'Unknown'}{' '}
              <span className="text-xs font-normal text-slate-500">({selectedRole})</span>
            </h3>
          </div>
          <Button size="sm" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="space-y-4 overflow-y-auto p-4">
          {!isAbsent && (
            <>
              <p className="text-xs text-slate-500">
                Tap another player to swap roles. Plan re-balances from here on.
              </p>

              <Section title="Keeper">
                {gkPlayer ? (
                  <Chip
                    label={gkPlayer.name}
                    color="gk"
                    disabled={gkPlayer.id === selectedPlayerId}
                    onClick={() => handleSwap(gkPlayer.id)}
                  />
                ) : (
                  <p className="text-xs text-slate-400">—</p>
                )}
              </Section>

              <Section title="On field">
                <div className="flex flex-wrap gap-1.5">
                  {fieldPlayers.map((p) => (
                    <Chip
                      key={p.id}
                      label={p.name}
                      color="field"
                      disabled={p.id === selectedPlayerId}
                      onClick={() => handleSwap(p.id)}
                    />
                  ))}
                </div>
              </Section>

              <Section title="On bench">
                <div className="flex flex-wrap gap-1.5">
                  {benchPlayers.length === 0 ? (
                    <p className="text-xs text-slate-400">—</p>
                  ) : (
                    benchPlayers.map((p) => (
                      <Chip
                        key={p.id}
                        label={p.name}
                        color="bench"
                        disabled={p.id === selectedPlayerId}
                        onClick={() => handleSwap(p.id)}
                      />
                    ))
                  )}
                </div>
              </Section>
            </>
          )}

          {absentPlayers.length > 0 && (
            <Section title="Absent">
              <div className="flex flex-wrap gap-1.5">
                {absentPlayers.map((p) => {
                  const credited = slot.absentCreditedIds.includes(p.id)
                  return (
                    <Chip
                      key={p.id}
                      label={credited ? `${p.name} ✕*` : `${p.name} ✕`}
                      color="absent"
                      disabled={p.id === selectedPlayerId}
                      onClick={() => handleSwap(p.id)}
                    />
                  )
                })}
              </div>
            </Section>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {isAbsent ? 'Mark present' : 'Mark absent'}
            </p>
            {!isAbsent && (
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={credit}
                  onChange={(e) => setCredit(e.target.checked)}
                  className="h-4 w-4"
                />
                Counts as field time for fairness
              </label>
            )}
            <div className="grid grid-cols-3 gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                disabled={scopeTooFew.segment}
                onClick={() => (isAbsent ? handleMarkPresent('segment') : handleMarkAbsent('segment'))}
              >
                Segment
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={scopeTooFew.period}
                onClick={() => (isAbsent ? handleMarkPresent('period') : handleMarkAbsent('period'))}
              >
                Rest of period
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={scopeTooFew.match}
                onClick={() => (isAbsent ? handleMarkPresent('match') : handleMarkAbsent('match'))}
              >
                Rest of match
              </Button>
            </div>
            {anyTooFew && (
              <p className="text-[11px] text-rose-700">
                Not enough players on field after absence ({totalOnField} required).
              </p>
            )}
          </div>

          {hasPinHere && (
            <Button size="sm" variant="secondary" fullWidth onClick={handleClearPin}>
              Clear pin · let solver re-decide this segment
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{title}</p>
      {children}
    </div>
  )
}

function Chip({
  label,
  color,
  disabled,
  onClick,
}: {
  label: string
  color: 'gk' | 'field' | 'bench' | 'absent'
  disabled?: boolean
  onClick: () => void
}) {
  const cls = {
    gk: 'bg-yellow-200 text-yellow-900 hover:bg-yellow-300',
    field: 'bg-blue-200 text-blue-900 hover:bg-blue-300',
    bench: 'bg-slate-200 text-slate-700 hover:bg-slate-300',
    absent: 'bg-rose-100 text-rose-800 hover:bg-rose-200',
  }[color]
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        'rounded-lg px-2.5 py-1 text-xs font-medium transition',
        cls,
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
    >
      {label}
    </button>
  )
}
