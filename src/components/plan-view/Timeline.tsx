import { useMemo, useState } from 'react'
import type { Player, SportConfig, TimeSlot } from '../../types'
import { getSlotPitchMinutesByPlayer } from '../../utils/pitchTime'

interface TimelineProps {
  slots: TimeSlot[]
  sportConfig: SportConfig
  players: Player[]
  /** Optional: invoked when a cell is clicked. (segmentIndex, playerId) */
  onCellClick?: (segmentIndex: number, playerId: string) => void
}

type CellState = 'gk' | 'field' | 'bench' | 'absent' | 'absent-credited' | 'unknown'

const stateBg: Record<CellState, string> = {
  gk: 'bg-yellow-300 text-yellow-900',
  field: 'bg-blue-200 text-blue-900',
  bench: 'bg-slate-200 text-slate-500',
  absent: 'bg-rose-100 text-rose-700',
  'absent-credited': 'bg-rose-200 text-rose-800',
  unknown: 'bg-slate-50 text-slate-300',
}

const stateGlyph: Record<CellState, string> = {
  gk: 'GK',
  field: '·',
  bench: '—',
  absent: '✕',
  'absent-credited': '✕*',
  unknown: '',
}

function fmtMin(m: number) {
  return `${Math.floor(m)}'`
}

function cellState(slot: TimeSlot, playerId: string): CellState {
  if (slot.gkId === playerId) return 'gk'
  if (slot.fieldIds.includes(playerId)) return 'field'
  if (slot.benchIds.includes(playerId)) return 'bench'
  if (slot.absentCreditedIds.includes(playerId)) return 'absent-credited'
  if (slot.absentIds.includes(playerId)) return 'absent'
  return 'unknown'
}

function preCellState(slot: TimeSlot, playerId: string): CellState {
  const swap = slot.midSwap
  if (!swap) return cellState(slot, playerId)
  if (swap.preGkId === playerId) return 'gk'
  if (swap.preFieldIds.includes(playerId)) return 'field'
  if (swap.preBenchIds.includes(playerId)) return 'bench'
  if (slot.absentCreditedIds.includes(playerId)) return 'absent-credited'
  if (slot.absentIds.includes(playerId)) return 'absent'
  return 'unknown'
}

function isOnFieldState(state: CellState) {
  return state === 'gk' || state === 'field'
}

function isBenchState(state: CellState) {
  return state === 'bench'
}

interface PlayerStats {
  benchStints: number
  minConsecutiveOnField: number
  maxConsecutiveOnField: number
  subbedOffCount: number
  subbedOnCount: number
  totalSubEvents: number
}

interface MutablePlayerStats extends Omit<PlayerStats, 'totalSubEvents'> {
  currentOnFieldRun: number
  currentRunTouchesMatchStart: boolean
  currentRunTouchesMatchEnd: boolean
  previousState: CellState | null
  previousMatchIndex: number | null
}

function finalizeRun(stats: MutablePlayerStats) {
  if (stats.currentOnFieldRun <= 0) return
  const touchesNoMatchEdge = !stats.currentRunTouchesMatchStart && !stats.currentRunTouchesMatchEnd
  const touchesBothMatchEdges = stats.currentRunTouchesMatchStart && stats.currentRunTouchesMatchEnd
  if (
    (touchesNoMatchEdge || touchesBothMatchEdges) &&
    stats.currentOnFieldRun < stats.minConsecutiveOnField
  ) {
    stats.minConsecutiveOnField = stats.currentOnFieldRun
  }
  if (stats.currentOnFieldRun > stats.maxConsecutiveOnField) {
    stats.maxConsecutiveOnField = stats.currentOnFieldRun
  }
  stats.currentOnFieldRun = 0
  stats.currentRunTouchesMatchStart = false
  stats.currentRunTouchesMatchEnd = false
}

export function buildPlayerStatsMap(slots: TimeSlot[], players: Player[]) {
  const playerStats = new Map<string, MutablePlayerStats>(
    players.map((player) => [
      player.id,
      {
        benchStints: 0,
        minConsecutiveOnField: Number.POSITIVE_INFINITY,
        maxConsecutiveOnField: 0,
        currentOnFieldRun: 0,
        currentRunTouchesMatchStart: false,
        currentRunTouchesMatchEnd: false,
        subbedOffCount: 0,
        subbedOnCount: 0,
        previousState: null,
        previousMatchIndex: null,
      },
    ]),
  )

  for (const [slotIndex, slot] of slots.entries()) {
    const slotMinutes = Math.max(0, slot.endMinute - slot.startMinute)
    const prevSlot = slots[slotIndex - 1]
    const nextSlot = slots[slotIndex + 1]

    for (const player of players) {
      const stats = playerStats.get(player.id)
      if (!stats) continue
      const state = cellState(slot, player.id)
      const onField = isOnFieldState(state)
      const wasOnField = stats.previousState ? isOnFieldState(stats.previousState) : false
      const wasBench = stats.previousState ? isBenchState(stats.previousState) : false
      const sameMatch = stats.previousState !== null && stats.previousMatchIndex === slot.matchIndex

      if (!sameMatch) {
        if (stats.currentOnFieldRun > 0) stats.currentRunTouchesMatchEnd = true
        finalizeRun(stats)
      }

      if (isBenchState(state) && (!sameMatch || !wasBench)) {
        stats.benchStints += 1
      }

      if (onField) {
        if (
          stats.currentOnFieldRun <= 0 &&
          (!prevSlot || prevSlot.matchIndex !== slot.matchIndex)
        ) {
          stats.currentRunTouchesMatchStart = true
        }
        stats.currentOnFieldRun += slotMinutes
        if (!nextSlot || nextSlot.matchIndex !== slot.matchIndex) {
          stats.currentRunTouchesMatchEnd = true
        }
      } else {
        finalizeRun(stats)
      }

      if (sameMatch) {
        if (wasOnField && isBenchState(state)) stats.subbedOffCount += 1
        if (wasBench && onField) stats.subbedOnCount += 1
      }

      stats.previousState = state
      stats.previousMatchIndex = slot.matchIndex
    }
  }

  const result = new Map<string, PlayerStats>()
  for (const player of players) {
    const stats = playerStats.get(player.id)
    if (!stats) continue
    finalizeRun(stats)
    result.set(player.id, {
      benchStints: stats.benchStints,
      minConsecutiveOnField:
        stats.minConsecutiveOnField === Number.POSITIVE_INFINITY ? 0 : stats.minConsecutiveOnField,
      maxConsecutiveOnField: stats.maxConsecutiveOnField,
      subbedOffCount: stats.subbedOffCount,
      subbedOnCount: stats.subbedOnCount,
      totalSubEvents: stats.subbedOffCount + stats.subbedOnCount,
    })
  }
  return result
}

export function Timeline({ slots, sportConfig, players, onCellClick }: TimelineProps) {
  const [hoverSeg, setHoverSeg] = useState<number | null>(null)
  const playerStats = useMemo(
    () => buildPlayerStatsMap(slots, players),
    [players, slots],
  )
  if (slots.length === 0) return null

  const fieldMinutes = new Map<string, number>()
  for (const p of players) fieldMinutes.set(p.id, 0)
  for (const slot of slots) {
    for (const [playerId, minutes] of getSlotPitchMinutesByPlayer(slot).entries()) {
      fieldMinutes.set(playerId, (fieldMinutes.get(playerId) ?? 0) + minutes)
    }
  }
  const totalMatchMinutes = sportConfig.periodCount * sportConfig.periodDurationMinutes

  // Compute next-rotation deltas per segment
  const deltas: { off: string[]; on: string[] }[] = slots.map((slot, i) => {
    const next = slots[i + 1]
    if (!next || next.matchIndex !== slot.matchIndex) return { off: [], on: [] }
    const cur = new Set([...(slot.gkId ? [slot.gkId] : []), ...slot.fieldIds])
    const nxt = new Set([...(next.gkId ? [next.gkId] : []), ...next.fieldIds])
    return {
      off: [...cur].filter((id) => !nxt.has(id)),
      on: [...nxt].filter((id) => !cur.has(id)),
    }
  })

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max border-separate border-spacing-0 text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-20 min-w-[8rem] rounded-tl-xl bg-slate-100 py-2 pr-3 text-left font-semibold text-slate-600">
              Player
            </th>
            {slots.map((slot, index) => {
              const prev = slots[index - 1]
              const matchStart = !prev || prev.matchIndex !== slot.matchIndex
              const periodStart = !prev || prev.periodIndex !== slot.periodIndex || matchStart
              const tint = slot.periodIndex % 2 === 0 ? 'bg-slate-100' : 'bg-blue-50'
              return (
                <th
                  key={`${slot.id}_group`}
                  className={[
                    'py-2 px-1 text-center text-[11px] font-semibold text-slate-500',
                    tint,
                    matchStart ? 'border-l-4 border-slate-300' : periodStart ? 'border-l-2 border-blue-200' : '',
                  ].join(' ')}
                >
                  {matchStart
                    ? `M${slot.matchIndex + 1} · P${slot.periodIndex + 1}`
                    : periodStart
                      ? `P${slot.periodIndex + 1}`
                      : ''}
                </th>
              )
            })}
            <th className="bg-slate-100 py-2 px-2 text-center font-semibold text-slate-600 min-w-[3.5rem]">
              Min
            </th>
            <th
              className="bg-slate-100 py-2 px-2 text-center font-semibold text-slate-600 min-w-[3rem]"
              title="Bench stints"
            >
              <span aria-hidden="true">Bench</span>
              <span className="sr-only">Bench stints</span>
            </th>
            <th
              className="bg-slate-100 py-2 px-2 text-center font-semibold text-slate-600 min-w-[3rem]"
              title="Min consecutive on-field minutes"
            >
              <span aria-hidden="true">Min C</span>
              <span className="sr-only">Minimum consecutive on-field minutes</span>
            </th>
            <th
              className="bg-slate-100 py-2 px-2 text-center font-semibold text-slate-600 min-w-[3rem]"
              title="Max consecutive on-field minutes"
            >
              <span aria-hidden="true">Max C</span>
              <span className="sr-only">Maximum consecutive on-field minutes</span>
            </th>
            <th
              className="bg-slate-100 py-2 px-2 text-center font-semibold text-slate-600 min-w-[3rem]"
              title="Times subbed off"
            >
              <span aria-hidden="true">Off</span>
              <span className="sr-only">Times subbed off</span>
            </th>
            <th
              className="bg-slate-100 py-2 px-2 text-center font-semibold text-slate-600 min-w-[3rem]"
              title="Times subbed on"
            >
              <span aria-hidden="true">On</span>
              <span className="sr-only">Times subbed on</span>
            </th>
            <th
              className="rounded-tr-xl bg-slate-100 py-2 px-2 text-center font-semibold text-slate-600 min-w-[3rem]"
              title="Total substitutions (on + off)"
            >
              <span aria-hidden="true">Subs</span>
              <span className="sr-only">Total substitutions (on plus off)</span>
            </th>
          </tr>
          <tr>
            <th className="text-left py-1.5 pr-3 font-semibold text-slate-600 sticky left-0 bg-slate-50 z-10 min-w-[8rem]">
              Player
            </th>
            {slots.map((slot, index) => {
              const prev = slots[index - 1]
              const matchStart = !prev || prev.matchIndex !== slot.matchIndex
              const periodStart = !prev || prev.periodIndex !== slot.periodIndex || matchStart
              const tint = slot.periodIndex % 2 === 0 ? 'bg-slate-50' : 'bg-blue-50/70'
              return (
                <th
                  key={slot.id}
                  className={[
                    'py-1.5 px-1 text-center font-medium text-slate-500 whitespace-nowrap min-w-[3.1rem] lg:min-w-[2.75rem]',
                    tint,
                    matchStart ? 'border-l-4 border-slate-300' : periodStart ? 'border-l-2 border-blue-200' : '',
                  ].join(' ')}
                >
                  {fmtMin(slot.startMinute)}
                </th>
              )
            })}
            <th className="py-1.5 px-2 text-center font-semibold text-slate-600 min-w-[3rem]">Min</th>
            <th className="py-1.5 px-2 text-center font-semibold text-slate-600 min-w-[3rem]">
              <span aria-hidden="true">B</span>
              <span className="sr-only">Bench stints</span>
            </th>
            <th className="py-1.5 px-2 text-center font-semibold text-slate-600 min-w-[3rem]">
              <span aria-hidden="true">Min C</span>
              <span className="sr-only">Minimum consecutive on-field minutes</span>
            </th>
            <th className="py-1.5 px-2 text-center font-semibold text-slate-600 min-w-[3rem]">
              <span aria-hidden="true">Max C</span>
              <span className="sr-only">Maximum consecutive on-field minutes</span>
            </th>
            <th className="py-1.5 px-2 text-center font-semibold text-slate-600 min-w-[3rem]">
              <span aria-hidden="true">Off</span>
              <span className="sr-only">Times subbed off</span>
            </th>
            <th className="py-1.5 px-2 text-center font-semibold text-slate-600 min-w-[3rem]">
              <span aria-hidden="true">On</span>
              <span className="sr-only">Times subbed on</span>
            </th>
            <th className="py-1.5 px-2 text-center font-semibold text-slate-600 min-w-[3rem]">
              <span aria-hidden="true">Subs</span>
              <span className="sr-only">Total substitutions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => {
            const mins = fieldMinutes.get(player.id) ?? 0
            const pct = totalMatchMinutes > 0 ? Math.round((mins / totalMatchMinutes) * 100) : 0
            const stats = playerStats.get(player.id) ?? {
              benchStints: 0,
              minConsecutiveOnField: 0,
              maxConsecutiveOnField: 0,
              subbedOffCount: 0,
              subbedOnCount: 0,
              totalSubEvents: 0,
            }
            return (
              <tr key={player.id} className="border-t border-slate-200">
                <td className="py-1.5 pr-3 font-medium text-slate-800 sticky left-0 bg-white z-10 truncate max-w-[8rem]">
                  {player.name}
                </td>
                {slots.map((slot, index) => {
                  const prev = slots[index - 1]
                  const matchStart = !prev || prev.matchIndex !== slot.matchIndex
                  const periodStart = !prev || prev.periodIndex !== slot.periodIndex || matchStart
                  const tint = slot.periodIndex % 2 === 0 ? 'bg-white' : 'bg-blue-50/40'
                  const state = cellState(slot, player.id)
                  const preState = preCellState(slot, player.id)
                  const splitInSeg = !!slot.midSwap && preState !== state
                  const isComingOff = deltas[index]?.off.includes(player.id)
                  const isComingOn = deltas[index]?.on.includes(player.id)
                  const isHoverSeg = hoverSeg === index
                  return (
                    <td
                      key={slot.id}
                      onMouseEnter={() => setHoverSeg(index)}
                      onMouseLeave={() => setHoverSeg((h) => (h === index ? null : h))}
                      className={[
                        'py-1 px-1 text-center',
                        tint,
                        matchStart ? 'border-l-4 border-slate-300' : periodStart ? 'border-l-2 border-blue-200' : '',
                        isHoverSeg ? 'bg-amber-50/60' : '',
                      ].join(' ')}
                    >
                      <button
                        type="button"
                        onClick={() => onCellClick?.(index, player.id)}
                        title={
                          splitInSeg
                            ? `Mid-segment swap at ${Math.floor(slot.midSwap!.atMinute)}'`
                            : onCellClick
                              ? 'Edit at this segment'
                              : undefined
                        }
                        className={[
                          'relative inline-flex w-full h-6 items-center justify-center overflow-hidden rounded text-[11px] font-semibold leading-none',
                          splitInSeg ? '' : stateBg[state],
                          isComingOff ? 'ring-2 ring-amber-500' : '',
                          onCellClick ? 'hover:ring-2 hover:ring-blue-400 cursor-pointer' : 'cursor-default',
                        ].join(' ')}
                      >
                        {splitInSeg && (
                          <>
                            <span className={['absolute inset-y-0 left-0 w-1/2', stateBg[preState]].join(' ')} />
                            <span className={['absolute inset-y-0 right-0 w-1/2', stateBg[state]].join(' ')} />
                          </>
                        )}
                        <span className="relative">{stateGlyph[state]}</span>
                        {isComingOff && <span className="relative ml-0.5 text-amber-900">↓</span>}
                        {isComingOn && <span className="relative ml-0.5 text-green-700">↑</span>}
                      </button>
                    </td>
                  )
                })}
                <td className="py-1.5 px-2 text-center font-semibold text-slate-700">
                  {Math.round(mins)}'
                  <span className="block text-slate-400 font-normal">{pct}%</span>
                </td>
                <td className="py-1.5 px-2 text-center font-semibold text-slate-700">{stats.benchStints}</td>
                <td className="py-1.5 px-2 text-center font-semibold text-slate-700">
                  {Math.round(stats.minConsecutiveOnField)}'
                </td>
                <td className="py-1.5 px-2 text-center font-semibold text-slate-700">
                  {Math.round(stats.maxConsecutiveOnField)}'
                </td>
                <td className="py-1.5 px-2 text-center font-semibold text-slate-700">{stats.subbedOffCount}</td>
                <td className="py-1.5 px-2 text-center font-semibold text-slate-700">{stats.subbedOnCount}</td>
                <td className="py-1.5 px-2 text-center font-semibold text-slate-700">{stats.totalSubEvents}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-300 bg-slate-50">
            <td className="py-1.5 pr-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 sticky left-0 bg-slate-50 z-10">
              Next sub
            </td>
            {slots.map((slot, index) => {
              const prev = slots[index - 1]
              const matchStart = !prev || prev.matchIndex !== slot.matchIndex
              const periodStart = !prev || prev.periodIndex !== slot.periodIndex || matchStart
              const d = deltas[index]
              const subs = d ? Math.max(d.off.length, d.on.length) : 0
              return (
                <td
                  key={slot.id}
                  className={[
                    'py-1 px-1 text-center text-[11px] text-slate-500',
                    matchStart ? 'border-l-4 border-slate-300' : periodStart ? 'border-l-2 border-blue-200' : '',
                  ].join(' ')}
                >
                  {subs > 0 ? `↕${subs}` : ''}
                </td>
              )
            })}
            <td />
            <td />
            <td />
            <td />
            <td />
            <td />
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
