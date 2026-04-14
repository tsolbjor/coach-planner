import { Link, useLocation } from 'react-router-dom'

export type FlowStep = 'home' | 'roster' | 'planner' | 'generated' | 'full'

export interface TopFlowNavItem {
  label: string
  to?: string
  active?: boolean
  disabled?: boolean
}

interface TopFlowNavProps {
  items: TopFlowNavItem[]
  className?: string
}

const flowLabels: Record<FlowStep, string> = {
  home: 'Home',
  planner: 'Rotation Setup',
  roster: 'Players',
  generated: 'Review Plan',
  full: 'Full Timeline',
}

export function buildTopFlowItems(planId?: string, activeStep?: FlowStep): TopFlowNavItem[] {
  return [
    { label: flowLabels.home, to: '/', active: activeStep === 'home' },
    {
      label: flowLabels.planner,
      to: planId ? `/plan/${planId}?step=planner` : undefined,
      active: activeStep === 'planner',
      disabled: !planId,
    },
    {
      label: flowLabels.roster,
      to: planId ? `/plan/${planId}?step=roster` : undefined,
      active: activeStep === 'roster',
      disabled: !planId,
    },
    {
      label: flowLabels.generated,
      to: planId ? `/plan/${planId}?step=generated` : undefined,
      active: activeStep === 'generated',
      disabled: !planId,
    },
    {
      label: flowLabels.full,
      to: planId ? `/plan/${planId}/view` : undefined,
      active: activeStep === 'full',
      disabled: !planId,
    },
  ]
}

export function TopFlowNav({ items, className = '' }: TopFlowNavProps) {
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const helpActive = searchParams.get('help') === '1'
  const helpParams = new URLSearchParams(searchParams)
  if (helpActive) {
    helpParams.delete('help')
  } else {
    helpParams.set('help', '1')
  }

  return (
    <nav className={['mb-6 overflow-x-auto pb-1', className].join(' ')} aria-label="App flow">
      <div className="inline-flex min-w-full items-center gap-2 rounded-[1.75rem] border border-slate-200/80 bg-white/85 p-2 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur">
        {items.map((item, index) => {
          const classes = [
            'inline-flex min-touch items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium whitespace-nowrap transition-all',
            item.active
              ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
              : item.disabled
                ? 'border-transparent bg-slate-100 text-slate-400'
                : 'border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900',
          ].join(' ')
          const stepBadgeClasses = [
            'inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold',
            item.active
              ? 'bg-white/15 text-white'
              : item.disabled
                ? 'bg-white text-slate-400'
                : 'bg-slate-100 text-slate-600',
          ].join(' ')

          if (item.to && !item.disabled) {
            return (
              <Link key={item.label} to={item.to} className={classes} aria-current={item.active ? 'page' : undefined}>
                <span className={stepBadgeClasses}>{index + 1}</span>
                {item.label}
              </Link>
            )
          }

          return (
            <span key={item.label} className={classes} aria-current={item.active ? 'page' : undefined}>
              <span className={stepBadgeClasses}>{index + 1}</span>
              {item.label}
            </span>
          )
        })}

        <Link
          to={{
            pathname: location.pathname,
            search: `?${helpParams.toString()}`,
          }}
          className={[
            'ml-auto inline-flex min-touch items-center rounded-2xl border px-3 py-2 text-sm font-medium whitespace-nowrap transition-all',
            helpActive
              ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
              : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white hover:text-slate-900',
          ].join(' ')}
          aria-current={helpActive ? 'page' : undefined}
        >
          Help
        </Link>
      </div>
    </nav>
  )
}
