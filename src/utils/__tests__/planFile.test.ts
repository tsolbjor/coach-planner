import { describe, expect, it } from 'vitest'
import { buildPlanFile, parsePlanFile } from '../planFile'
import { makeFiveASide, makePlayers } from '../../scheduler/__tests__/fixtures'
import type { SavedItem } from '../../types'

const item = {
  kind: 'match',
  plan: { id: 'a', name: 'M', sportConfig: makeFiveASide(), roster: makePlayers(7) },
} as unknown as SavedItem

describe('planFile', () => {
  it('round-trips items including player names', () => {
    const text = buildPlanFile([item])
    expect(text).toContain(makePlayers(7)[0]!.name)
    expect(parsePlanFile(text)).toEqual([item])
  })
  it('rejects bad input', () => {
    expect(() => parsePlanFile('nope')).toThrow(/not a Coach Planner/)
    expect(() => parsePlanFile('{"format":"coach-planner-plans","version":99,"items":[]}')).toThrow(/newer/)
    expect(() => parsePlanFile('{"format":"coach-planner-plans","version":1,"items":[{"kind":"match"}]}')).toThrow(/corrupted/)
  })
})
