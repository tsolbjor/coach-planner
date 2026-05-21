import type { LineupSlot, Player } from '../types'

/**
 * Maximum bipartite matching of slots to players using DFS with augmenting paths.
 * Returns map slotId → playerId for filled slots. Order of inputs determines tiebreaks.
 * Optional `preferPlayerBySlot` puts the preferred player first in that slot's candidate
 * list, so continuity assignments are tried before others while still allowing the
 * augmenting search to shift them when needed to fill every slot.
 */
export function maxMatch(
  slots: LineupSlot[],
  players: Player[],
  canPlay: (player: Player, positionTypeId: string) => boolean,
  preferPlayerBySlot?: Map<string, string>,
): Map<string, string> {
  const candidatesBySlot = new Map<string, Player[]>()
  for (const slot of slots) {
    const eligible = players.filter((p) => canPlay(p, slot.positionTypeId))
    const preferredId = preferPlayerBySlot?.get(slot.slotId)
    if (preferredId && eligible.some((p) => p.id === preferredId)) {
      const preferred = eligible.find((p) => p.id === preferredId)!
      const rest = eligible.filter((p) => p.id !== preferredId)
      candidatesBySlot.set(slot.slotId, [preferred, ...rest])
    } else {
      candidatesBySlot.set(slot.slotId, eligible)
    }
  }

  const matchedSlotByPlayer = new Map<string, string>()
  const matchedPlayerBySlot = new Map<string, string>()

  const assign = (slotId: string, visited: Set<string>): boolean => {
    const candidates = candidatesBySlot.get(slotId) ?? []
    for (const player of candidates) {
      if (visited.has(player.id)) continue
      visited.add(player.id)
      const currentSlotId = matchedSlotByPlayer.get(player.id)
      if (!currentSlotId || assign(currentSlotId, visited)) {
        matchedSlotByPlayer.set(player.id, slotId)
        matchedPlayerBySlot.set(slotId, player.id)
        return true
      }
    }
    return false
  }

  const orderedSlots = preferPlayerBySlot
    ? [
        ...slots.filter((s) => preferPlayerBySlot.has(s.slotId)),
        ...slots.filter((s) => !preferPlayerBySlot.has(s.slotId)),
      ]
    : slots
  for (const slot of orderedSlots) {
    assign(slot.slotId, new Set<string>())
  }

  return matchedPlayerBySlot
}

export function canPlayPosition(player: Player, positionTypeId: string): boolean {
  return !(player.excludedPositionTypeIds ?? []).includes(positionTypeId)
}
