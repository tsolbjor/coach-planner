import { useTheme } from '../../utils/theme'

export function ThemeToggle() {
  const [theme, setTheme] = useTheme()
  return (
    <div role="group" aria-label="Theme" className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-0.5">
      {(['light', 'dark'] as const).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => setTheme(t)}
          aria-pressed={theme === t}
          className={[
            'min-touch rounded-[0.875rem] px-3 py-1.5 text-sm font-medium transition-all',
            theme === t ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900',
          ].join(' ')}
        >
          {t === 'light' ? 'Light' : 'Dark'}
        </button>
      ))}
    </div>
  )
}
