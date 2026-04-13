export type SportPresetId = 'soccer' | 'handball' | 'custom'

/** A named position type that players can prefer (e.g. "Centre Back") */
export interface PositionType {
  id: string
  label: string
  shortLabel: string
  /** Used to group colors in the UI */
  group: 'keeper' | 'defender' | 'midfielder' | 'forward' | 'other'
  isKeeper: boolean
}

/** A single slot in the formation (e.g. the second CB slot) */
export interface LineupSlot {
  /** Unique slot identifier within this sport config, e.g. "cb_1", "cb_2" */
  slotId: string
  positionTypeId: string
  label: string
}

export interface SportConfig {
  presetId: SportPresetId
  name: string
  /** Total players on the field including keeper */
  totalOnField: number
  benchSize: number
  periodCount: number
  periodDurationMinutes: number
  hasKeeper: boolean
  positionTypes: PositionType[]
  /** Ordered lineup slots — length must equal totalOnField */
  lineupSlots: LineupSlot[]
}
