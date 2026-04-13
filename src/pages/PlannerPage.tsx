import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMatchStore, useRosterStore, useSettingsStore, useSavedPlansStore } from '../store'
import { generatePlan } from '../scheduler'
import type { TimeSlot } from '../types'
import { PageHeader } from '../components/common/PageHeader'
import { Button } from '../components/common/Button'
import { Card } from '../components/common/Card'
import { SubstitutionSettings } from '../components/planner/SubstitutionSettings'
import { SlotCard } from '../components/planner/SlotCard'
import { SlotEditor } from '../components/planner/SlotEditor'

export function PlannerPage() {
  const navigate = useNavigate()
  const { players } = useRosterStore()
  const { sportConfig, keeperMode, subsPerPeriod, setKeeperMode, setSubsPerPeriod } = useSettingsStore()
  const { plan, newPlan, setPlan, updateSlot, saveMatch: _saveMatch } = useMatchStore()
  const { saveMatch } = useSavedPlansStore()

  const [editingSlot, setEditingSlot] = useState<TimeSlot | null>(null)
  const [absentIds, setAbsentIds] = useState<string[]>(plan?.absentPlayerIds ?? [])
  const [warnings, setWarnings] = useState<string[]>([])
  const [planName, setPlanName] = useState(plan?.name ?? `Match ${new Date().toLocaleDateString()}`)

  const activePlayers = useMemo(
    () => players.filter((p) => !absentIds.includes(p.id)),
    [players, absentIds],
  )

  const totalMatchMinutes = sportConfig.periodCount * sportConfig.periodDurationMinutes

  // Compute cumulative field minutes per player across all slots
  const playerMinutes = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of players) m.set(p.id, 0)
    if (!plan) return m
    for (const slot of plan.slots) {
      const dur = slot.endMinute - slot.startMinute
      for (const pid of Object.values(slot.assignments)) {
        if (pid) m.set(pid, (m.get(pid) ?? 0) + dur)
      }
    }
    return m
  }, [plan, players])

  const handleGenerate = () => {
    const result = generatePlan({
      sportConfig,
      players: activePlayers,
      subsPerPeriod,
      keeperMode,
      existingSlots: plan?.slots,
    })
    setWarnings(result.warnings.map((w) => w.message))

    if (plan) {
      setPlan({ ...plan, slots: result.slots, name: planName, updatedAt: new Date().toISOString() })
    } else {
      newPlan({
        name: planName,
        sportConfig,
        roster: players,
        subsPerPeriod,
        keeperMode,
        slots: result.slots,
        absentPlayerIds: absentIds,
      })
    }
  }

  const handleSlotSave = (slotId: string, updates: Pick<TimeSlot, 'assignments' | 'bench' | 'locked'>) => {
    updateSlot(slotId, updates)
    setEditingSlot(null)
  }

  const handleSave = () => {
    if (!plan) return
    saveMatch({ ...plan, name: planName })
    navigate('/plan')
  }

  // Group slots by period
  const slotsByPeriod = useMemo(() => {
    if (!plan) return []
    const groups: TimeSlot[][] = Array.from({ length: sportConfig.periodCount }, () => [])
    for (const slot of plan.slots) {
      groups[slot.periodIndex]?.push(slot)
    }
    return groups
  }, [plan, sportConfig.periodCount])

  return (
    <div className="px-4 pb-12 max-w-lg mx-auto">
      <PageHeader title="Planner" backTo="/roster" />

      {/* Plan name */}
      <div className="mb-4">
        <input
          type="text"
          value={planName}
          onChange={(e) => setPlanName(e.target.value)}
          placeholder="Plan name"
          className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Settings */}
      <div className="mb-4">
        <SubstitutionSettings
          sportConfig={sportConfig}
          subsPerPeriod={subsPerPeriod}
          keeperMode={keeperMode}
          onSubsChange={setSubsPerPeriod}
          onKeeperModeChange={setKeeperMode}
        />
      </div>

      {/* Absent players */}
      {players.length > 0 && (
        <Card className="mb-4">
          <h3 className="font-semibold text-sm text-slate-700 mb-2">Mark absent players</h3>
          <div className="flex flex-wrap gap-2">
            {players.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() =>
                  setAbsentIds((prev) =>
                    prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id],
                  )
                }
                className={[
                  'px-2.5 py-1 text-sm rounded-xl border transition-colors',
                  absentIds.includes(p.id)
                    ? 'bg-red-100 border-red-300 text-red-700 line-through'
                    : 'bg-white border-slate-300 text-slate-700',
                ].join(' ')}
              >
                {p.name}
              </button>
            ))}
          </div>
          {absentIds.length > 0 && (
            <p className="text-xs text-slate-500 mt-2">
              {activePlayers.length} active players
            </p>
          )}
        </Card>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="mb-4 space-y-1">
          {warnings.map((w, i) => (
            <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm text-amber-700">
              ⚠️ {w}
            </div>
          ))}
        </div>
      )}

      {/* Generate button */}
      <Button fullWidth size="lg" className="mb-6" onClick={handleGenerate}>
        {plan ? 'Regenerate plan' : 'Generate plan'}
      </Button>

      {/* Slot list by period */}
      {slotsByPeriod.map((slots, pi) => (
        <div key={pi} className="mb-6">
          <h2 className="font-semibold text-slate-600 text-sm mb-2">
            {sportConfig.periodCount > 1 ? `Half ${pi + 1}` : 'Match'}
          </h2>
          <div className="space-y-2">
            {slots.map((slot) => (
              <SlotCard
                key={slot.id}
                slot={slot}
                sportConfig={sportConfig}
                players={players}
                playerMinutes={playerMinutes}
                totalMinutes={totalMatchMinutes}
                onEdit={() => setEditingSlot(slot)}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Save */}
      {plan && (
        <Button fullWidth variant="secondary" onClick={handleSave}>
          Save & view full plan →
        </Button>
      )}

      {/* Slot editor modal */}
      {editingSlot && (
        <SlotEditor
          slot={editingSlot}
          sportConfig={sportConfig}
          players={activePlayers}
          playerMinutes={playerMinutes}
          totalMinutes={totalMatchMinutes}
          onSave={(updates) => handleSlotSave(editingSlot.id, updates)}
          onClose={() => setEditingSlot(null)}
        />
      )}
    </div>
  )
}
