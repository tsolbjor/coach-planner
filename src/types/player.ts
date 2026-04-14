export interface Player {
  id: string
  name: string
  /** Optional shirt number */
  number?: number
  /** PositionType.id[] — positions this player should not be assigned to */
  excludedPositionTypeIds: string[]
}
