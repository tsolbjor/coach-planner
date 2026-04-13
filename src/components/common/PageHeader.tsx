import { useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  backTo?: string
  action?: ReactNode
}

export function PageHeader({ title, backTo, action }: PageHeaderProps) {
  const navigate = useNavigate()
  return (
    <header className="flex items-center gap-3 py-3 mb-4">
      {backTo && (
        <button
          onClick={() => navigate(backTo)}
          className="p-2 -ml-2 rounded-xl text-slate-600 hover:bg-slate-200 active:bg-slate-300 min-touch flex items-center justify-center"
          aria-label="Back"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      <h1 className="text-xl font-bold flex-1">{title}</h1>
      {action && <div>{action}</div>}
    </header>
  )
}
