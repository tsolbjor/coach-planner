import { useState } from 'react'
import type { Player, SportConfig } from '../../types'
import { PositionBadge } from './PositionBadge'
import { Button } from '../common/Button'

interface PlayerFormProps {
  initial?: Partial<Player>
  sportConfig: SportConfig
  onSave: (data: Omit<Player, 'id'>) => void
  onCancel: () => void
}

export function PlayerForm({ initial, sportConfig, onSave, onCancel }: PlayerFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [number, setNumber] = useState<string>(initial?.number?.toString() ?? '')
  const [preferred, setPreferred] = useState<string[]>(initial?.preferredPositionTypeIds ?? [])
  const [canKeeper, setCanKeeper] = useState(initial?.canBeKeeper ?? false)
  const [fixedKeeper, setFixedKeeper] = useState(initial?.isFixedKeeper ?? false)

  const togglePosition = (id: string) =>
    setPreferred((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id])

  const handleSubmit = () => {
    if (!name.trim()) return
    onSave({
      name: name.trim(),
      number: number ? parseInt(number, 10) : undefined,
      preferredPositionTypeIds: preferred,
      canBeKeeper: canKeeper || fixedKeeper,
      isFixedKeeper: fixedKeeper,
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Player name"
          className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Shirt number</label>
        <input
          type="number"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="Optional"
          min={1}
          max={99}
          className="w-32 border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {sportConfig.hasKeeper && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Goalkeeper</label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={canKeeper}
              onChange={(e) => { setCanKeeper(e.target.checked); if (!e.target.checked) setFixedKeeper(false) }}
              className="w-4 h-4 rounded text-blue-600"
            />
            <span className="text-sm">Can play keeper</span>
          </label>
          {canKeeper && (
            <label className="flex items-center gap-2 cursor-pointer ml-6">
              <input
                type="checkbox"
                checked={fixedKeeper}
                onChange={(e) => setFixedKeeper(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600"
              />
              <span className="text-sm">Fixed keeper (never rotated out)</span>
            </label>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Preferred positions</label>
        <div className="flex flex-wrap gap-2">
          {sportConfig.positionTypes.filter((pt) => !pt.isKeeper).map((pt) => (
            <PositionBadge
              key={pt.id}
              position={pt}
              selected={preferred.includes(pt.id)}
              onClick={() => togglePosition(pt.id)}
            />
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-1">Tap to toggle. Unselected = no preference.</p>
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="secondary" onClick={onCancel} fullWidth>Cancel</Button>
        <Button onClick={handleSubmit} disabled={!name.trim()} fullWidth>Save</Button>
      </div>
    </div>
  )
}
