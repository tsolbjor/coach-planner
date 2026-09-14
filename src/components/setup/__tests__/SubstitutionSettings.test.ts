import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { makeFiveASide } from '../../../scheduler/__tests__/fixtures'
import { SubstitutionSettings } from '../SubstitutionSettings'

describe('SubstitutionSettings', () => {
  it('shows rest in minutes and keeps substitution counts in closed advanced controls', () => {
    const noop = () => {}
    const html = renderToStaticMarkup(createElement(SubstitutionSettings, {
      sportConfig: makeFiveASide({ periodDurationMinutes: 20 }),
      benchStintMinutes: 7,
      matchCount: 1,
      changeKeeperMidPeriod: false,
      maxBenchSegments: 2,
      minSubsPerSegment: 0,
      maxSubsPerSegment: 2,
      benchSize: 2,
      onBenchStintChange: noop,
      onMatchCountChange: noop,
      onChangeKeeperMidPeriodChange: noop,
      onMaxBenchSegmentsChange: noop,
      onMinSubsPerSegmentChange: noop,
      onMaxSubsPerSegmentChange: noop,
    }))
    expect(html).toContain('Substitution interval')
    expect(html).toContain('Maximum continuous rest')
    expect(html).toContain('value="13.3"')
    expect(html).not.toContain('Minutes on bench')
    expect(html).toMatch(/<details>.*Preferred minimum substitutions.*Preferred maximum substitutions.*<\/details>/)
  })
})
