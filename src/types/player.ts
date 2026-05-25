export type PlayerLevel = 1 | 2 | 3

export const DEFAULT_PLAYER_LEVEL: PlayerLevel = 2

export function normalizePlayerLevel(level: number | null | undefined): PlayerLevel {
  return level === 1 || level === 2 || level === 3 ? level : DEFAULT_PLAYER_LEVEL
}

export interface Player {
  id: string
  name: string
  /** Relative player level used when balancing bench groups */
  level: PlayerLevel
  /** PositionType.id[] — positions this player should not be assigned to */
  excludedPositionTypeIds: string[]
}
