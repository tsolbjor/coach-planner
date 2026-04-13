import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRosterStore, useSettingsStore } from '../store'
import type { Player } from '../types'
import { PageHeader } from '../components/common/PageHeader'
import { Card } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { Modal } from '../components/common/Modal'
import { PlayerForm } from '../components/roster/PlayerForm'
import { PlayerListItem } from '../components/roster/PlayerListItem'

export function RosterPage() {
  const navigate = useNavigate()
  const { players, addPlayer, updatePlayer, removePlayer } = useRosterStore()
  const { sportConfig } = useSettingsStore()
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)

  const handleSaveNew = (data: Omit<Player, 'id'>) => {
    addPlayer(data)
    setShowAddModal(false)
  }

  const handleUpdate = (data: Omit<Player, 'id'>) => {
    if (!editingPlayer) return
    updatePlayer(editingPlayer.id, data)
    setEditingPlayer(null)
  }

  const handleDelete = (id: string) => {
    if (confirm('Remove this player from the roster?')) removePlayer(id)
  }

  const totalRoster = players.length
  const needed = sportConfig.totalOnField + sportConfig.benchSize
  const ready = totalRoster >= sportConfig.totalOnField

  return (
    <div className="px-4 pb-12 max-w-lg mx-auto">
      <PageHeader
        title="Roster"
        backTo="/setup"
        action={
          <Button size="sm" onClick={() => setShowAddModal(true)}>
            + Add player
          </Button>
        }
      />

      {/* Status */}
      <div className={['rounded-xl px-3 py-2 text-sm mb-4', ready ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'].join(' ')}>
        {totalRoster} player{totalRoster !== 1 ? 's' : ''} · Need {sportConfig.totalOnField} on field
        {sportConfig.benchSize > 0 ? ` + ${sportConfig.benchSize} bench (${needed} total)` : ''}
        {ready ? ' ✓' : ` — add ${sportConfig.totalOnField - totalRoster} more`}
      </div>

      {/* Player list */}
      {players.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <p className="text-lg mb-1">No players yet</p>
          <p className="text-sm">Tap "+ Add player" to get started</p>
        </div>
      ) : (
        <Card padding={false} className="mb-4">
          <div className="px-4">
            {players.map((p) => (
              <PlayerListItem
                key={p.id}
                player={p}
                sportConfig={sportConfig}
                onEdit={() => setEditingPlayer(p)}
                onDelete={() => handleDelete(p.id)}
              />
            ))}
          </div>
        </Card>
      )}

      <Button fullWidth size="lg" disabled={!ready} onClick={() => navigate('/planner')}>
        Continue to planner →
      </Button>

      {/* Add modal */}
      <Modal title="Add player" open={showAddModal} onClose={() => setShowAddModal(false)}>
        <PlayerForm
          sportConfig={sportConfig}
          onSave={handleSaveNew}
          onCancel={() => setShowAddModal(false)}
        />
      </Modal>

      {/* Edit modal */}
      <Modal title="Edit player" open={!!editingPlayer} onClose={() => setEditingPlayer(null)}>
        {editingPlayer && (
          <PlayerForm
            initial={editingPlayer}
            sportConfig={sportConfig}
            onSave={handleUpdate}
            onCancel={() => setEditingPlayer(null)}
          />
        )}
      </Modal>
    </div>
  )
}
