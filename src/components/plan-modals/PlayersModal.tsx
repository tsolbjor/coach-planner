import type { MatchPlan, Player } from '../../types'
import { DEFAULT_PLAYER_LEVEL } from '../../types'
import { useSavedPlansStore } from '../../store'
import { Card } from '../common/Card'
import { Button } from '../common/Button'
import { PlayerListItem } from '../roster/PlayerListItem'
import { ModalShell } from './ModalShell'

interface PlayersModalProps {
  plan: MatchPlan
  onClose: () => void
}

export function PlayersModal({ plan, onClose }: PlayersModalProps) {
  const { addMatchPlayer, updateMatchPlayer, removeMatchPlayer, updateMatch } = useSavedPlansStore()

  const { sportConfig, roster, absentPlayerIds } = plan
  const needed = sportConfig.totalOnField + sportConfig.benchSize
  const ready = roster.length >= sportConfig.totalOnField
  const activePlayerCount = roster.length - absentPlayerIds.length

  const handleSaveNew = (data: Omit<Player, 'id'>) => addMatchPlayer(plan.id, data)
  const handleUpdate = (playerId: string, data: Omit<Player, 'id'>) =>
    updateMatchPlayer(plan.id, playerId, data)
  const handleDelete = (playerId: string) => {
    if (confirm('Remove this player?')) removeMatchPlayer(plan.id, playerId)
  }
  const toggleAbsent = (playerId: string) => {
    const next = absentPlayerIds.includes(playerId)
      ? absentPlayerIds.filter((id) => id !== playerId)
      : [...absentPlayerIds, playerId]
    updateMatch(plan.id, { absentPlayerIds: next })
  }
  const handleGeneratePlayers = () => {
    for (let i = roster.length + 1; i <= needed; i++) {
      addMatchPlayer(plan.id, {
        name: `Player ${i}`,
        level: DEFAULT_PLAYER_LEVEL,
        excludedPositionTypeIds: [],
      })
    }
  }

  return (
    <ModalShell title="Players" eyebrow="Roster" onClose={onClose} maxWidth="xl">
      <div className="space-y-4">
        <div
          className={[
            'rounded-xl px-3 py-2 text-sm',
            ready ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700',
          ].join(' ')}
        >
          {roster.length} player{roster.length !== 1 ? 's' : ''} · Need {sportConfig.totalOnField} on field
          {sportConfig.benchSize > 0 ? ` + ${sportConfig.benchSize} bench (${needed} total)` : ''}
          {ready ? ' ✓' : ` — ${needed - roster.length} more needed`}
          {absentPlayerIds.length > 0 ? ` · ${activePlayerCount} active` : ''}
        </div>
        <p className="text-xs text-slate-500">
          Protected: prefer no more than one of these players on the bench together. Standard players have the same rotation priority. Existing L1 players are protected; L2 and L3 are standard.
        </p>

        {roster.length === 0 ? (
          <div className="py-8 text-center text-slate-400">
            <p className="mb-3">No players yet</p>
            <Button onClick={handleGeneratePlayers}>Generate {needed} players</Button>
          </div>
        ) : (
          <Card padding={false}>
            <div className="px-4">
              {roster.map((player) => (
                <PlayerListItem
                  key={player.id}
                  player={player}
                  sportConfig={sportConfig}
                  absent={absentPlayerIds.includes(player.id)}
                  onToggleAbsent={() => toggleAbsent(player.id)}
                  onDelete={() => handleDelete(player.id)}
                  onSave={(data) => handleUpdate(player.id, data)}
                />
              ))}
            </div>
          </Card>
        )}

        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            handleSaveNew({
              name: `Player ${roster.length + 1}`,
              level: DEFAULT_PLAYER_LEVEL,
              excludedPositionTypeIds: [],
            })
          }
          fullWidth
        >
          + Add player
        </Button>
      </div>
    </ModalShell>
  )
}
