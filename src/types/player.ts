export interface Player {
  id: string
  name: string
  /** Optional shirt number */
  number?: number
  /** PositionType.id[] — positions this player prefers */
  preferredPositionTypeIds: string[]
  canBeKeeper: boolean
  isFixedKeeper: boolean
}
