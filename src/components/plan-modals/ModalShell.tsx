import type { ReactNode } from 'react'
import { Button } from '../common/Button'

interface ModalShellProps {
  title: string
  eyebrow?: string
  onClose: () => void
  children: ReactNode
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl'
}

const widthClass = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export function ModalShell({ title, eyebrow, onClose, children, maxWidth = 'lg' }: ModalShellProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 p-3 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        className={[
          'flex max-h-[calc(100dvh-1.5rem)] w-full min-w-0 flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.25)] sm:max-h-[min(92dvh,calc(100dvh-3rem))]',
          widthClass[maxWidth],
        ].join(' ')}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-4 py-4 sm:px-6">
          <div>
            {eyebrow && (
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">{eyebrow}</p>
            )}
            <h2 className="mt-1 text-xl font-bold text-slate-900">{title}</h2>
          </div>
          <Button size="sm" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-6">{children}</div>
      </div>
    </div>
  )
}
