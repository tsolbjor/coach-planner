import LZString from 'lz-string'
import type { MatchPlan } from '../types'

export function encodePlan(plan: MatchPlan): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify(plan))
}

export function decodePlan(encoded: string): MatchPlan | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded)
    if (!json) return null
    return JSON.parse(json) as MatchPlan
  } catch {
    return null
  }
}

export function buildShareUrl(plan: MatchPlan): string {
  const base = window.location.href.split('#')[0]
  return `${base}#/import?plan=${encodePlan(plan)}`
}
