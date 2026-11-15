import type { SavedItem } from '../types'

export const PLAN_FILE_FORMAT = 'coach-planner-plans'
export const PLAN_FILE_VERSION = 1

export function buildPlanFile(items: SavedItem[]): string {
  return JSON.stringify(
    { format: PLAN_FILE_FORMAT, version: PLAN_FILE_VERSION, exportedAt: new Date().toISOString(), items },
    null,
    2,
  )
}

function isItem(value: unknown): value is SavedItem {
  if (!value || typeof value !== 'object') return false
  const { kind, plan } = value as { kind?: unknown; plan?: Record<string, unknown> }
  if (kind !== 'match' && kind !== 'tournament') return false
  if (!plan || typeof plan !== 'object') return false
  if (typeof plan.id !== 'string' || typeof plan.name !== 'string') return false
  if (!Array.isArray(plan.roster) || !plan.sportConfig || typeof plan.sportConfig !== 'object') return false
  return kind === 'match' || Array.isArray(plan.matches)
}

/** Parses an exported plan file. Throws an Error with a user-facing message if it is not usable. */
export function parsePlanFile(text: string): SavedItem[] {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('This file is not a Coach Planner export.')
  }
  const file = data as { format?: unknown; version?: unknown; items?: unknown }
  if (!file || file.format !== PLAN_FILE_FORMAT || !Array.isArray(file.items)) {
    throw new Error('This file is not a Coach Planner export.')
  }
  if (typeof file.version !== 'number' || file.version > PLAN_FILE_VERSION) {
    throw new Error('This file was made by a newer version of the app. Update the app and try again.')
  }
  if (!file.items.length) throw new Error('The file contains no plans.')
  if (!file.items.every(isItem)) throw new Error('The file is corrupted: some plans are invalid.')
  return file.items
}
