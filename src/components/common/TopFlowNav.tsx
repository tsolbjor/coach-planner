import { Link, useLocation } from 'react-router-dom'

export type FlowStep = 'home' | 'plan'

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
  plan: 'Plan',
}

export function buildTopFlowItems(planId?: string, activeStep?: FlowStep): TopFlowNavItem[] {
  return [
    { label: flowLabels.home, to: '/', active: activeStep === 'home' },
    {
      label: flowLabels.plan,
      to: planId ? `/plan/${planId}` : undefined,
      active: activeStep === 'plan',
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
        {items.map((item) => {
          const classes = [
            'inline-flex min-touch items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium whitespace-nowrap transition-all',
            item.active
              ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
              : item.disabled
                ? 'border-transparent bg-slate-100 text-slate-400'
                : 'border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900',
          ].join(' ')

          if (item.to && !item.disabled) {
            return (
              <Link key={item.label} to={item.to} className={classes} aria-current={item.active ? 'page' : undefined}>
                {item.label}
              </Link>
            )
          }
          return (
            <span key={item.label} className={classes} aria-current={item.active ? 'page' : undefined}>
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
