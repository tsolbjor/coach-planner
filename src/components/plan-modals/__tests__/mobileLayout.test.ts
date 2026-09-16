import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { makeFiveASide, makePlayers } from '../../../scheduler/__tests__/fixtures'
import { NumberStepper } from '../../common/NumberStepper'
import { PageHeader } from '../../common/PageHeader'
import { Timeline } from '../../plan-view/Timeline'
import { PlayerListItem } from '../../roster/PlayerListItem'
import { ModalShell } from '../ModalShell'

describe('mobile modal layout', () => {
  it('contains absolute timeline labels so they cannot expand the modal viewport', () => {
    const html = renderToStaticMarkup(createElement(Timeline, {
      slots: [{
        id: 'slot-1',
        matchIndex: 0,
        periodIndex: 0,
        startMinute: 0,
        endMinute: 5,
        gkId: null,
        fieldIds: [],
        benchIds: [],
        absentIds: [],
        absentCreditedIds: [],
        positions: {},
      }],
      players: makePlayers(7),
      sportConfig: makeFiveASide(),
      onCellClick: () => {},
    }))

    expect(html).toContain('class="relative overflow-x-auto"')
    expect(html).toContain('sr-only')
  })

  it('constrains plan toolbar actions to the available page width', () => {
    const html = renderToStaticMarkup(createElement(MemoryRouter, {
      children: createElement(PageHeader, {
        title: 'Plan',
        action: 'Players Setup Share Print',
      }),
    }))

    expect(html).toContain('ml-auto max-w-full shrink-0')
  })

  it('bounds the modal to the dynamic viewport and keeps its header outside scrolling content', () => {
    const html = renderToStaticMarkup(createElement(ModalShell, {
      title: 'Players',
      onClose: () => {},
      children: 'Roster content',
    }))

    expect(html).toContain('max-h-[calc(100dvh-1.5rem)]')
    expect(html).toContain('flex shrink-0 items-start')
    expect(html).toContain('min-h-0 overflow-y-auto overscroll-contain')
    expect(html).toContain('Close')
    expect(html).toContain('Roster content')
  })

  it('wraps player controls on small screens while retaining the desktop row', () => {
    const html = renderToStaticMarkup(createElement(PlayerListItem, {
      player: makePlayers(1)[0],
      sportConfig: makeFiveASide(),
      onSave: () => {},
      onDelete: () => {},
      onToggleAbsent: () => {},
    }))

    expect(html).toContain('flex flex-wrap items-center gap-3 md:flex-nowrap')
    expect(html).toContain('min-w-0 flex-1 md:w-44 md:flex-none')
    expect(html).toContain('md:min-w-max md:flex-nowrap')
    expect(html).toContain('Bench-group preference')
    expect(html).toContain('Mark absent')
    expect(html).toContain('Remove player')
  })

  it('stacks stepper labels on mobile and bounds number inputs with suffixes', () => {
    const html = renderToStaticMarkup(createElement(NumberStepper, {
      label: 'Maximum continuous rest',
      value: 12.5,
      suffix: ' min',
      step: 0.5,
      onChange: () => {},
    }))

    expect(html).toContain('basis-full sm:basis-auto')
    expect(html).toContain('flex w-20 items-center')
    expect(html).toContain('min-w-0 w-full')
    expect(html).toContain('value="12.5"')
    expect(html).toContain('Decrease')
    expect(html).toContain('Increase')
  })
})
