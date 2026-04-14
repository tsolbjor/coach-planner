import type { ReactNode } from 'react'
import { TopFlowNav, type TopFlowNavItem } from './TopFlowNav'

type AppShellWidth = 'default' | 'wide' | 'full'

interface AppShellProps {
  children: ReactNode
  flowItems: TopFlowNavItem[]
  width?: AppShellWidth
}

const widthClasses: Record<AppShellWidth, string> = {
  default: 'max-w-6xl',
  wide: 'max-w-7xl',
  full: 'max-w-[110rem]',
}

export function AppShell({
  children,
  flowItems,
  width = 'default',
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.08),_transparent_32%),linear-gradient(to_bottom,_#f8fafc,_#f8fafc)]">
      <div className={['mx-auto px-4 pb-12 lg:px-6', widthClasses[width]].join(' ')}>
        <TopFlowNav items={flowItems} className="pt-4" />
        {children}
      </div>
    </div>
  )
}
