import type { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: boolean
}

export function Card({ padding = true, className = '', children, ...rest }: CardProps) {
  return (
    <div
      className={['bg-white rounded-2xl shadow-sm border border-slate-200', padding ? 'p-4' : '', className].join(' ')}
      {...rest}
    >
      {children}
    </div>
  )
}
