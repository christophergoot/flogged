import { useState, useEffect, useRef } from 'react'
import type { Theme } from './lib/theme'

const SunIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
)

const MoonIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
)

const AutoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
)

const icons = { dark: MoonIcon, light: SunIcon, auto: AutoIcon }

const options: { value: Theme; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'auto', label: 'System' },
  { value: 'light', label: 'Light' },
]

interface ThemeToggleProps {
  theme: Theme
  onChange: (theme: Theme) => void
}

export function ThemeToggle({ theme, onChange }: ThemeToggleProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const CurrentIcon = icons[theme]

  return (
    <div className="theme-picker" ref={ref}>
      <button
        type="button"
        className="theme-picker-btn"
        onClick={() => setOpen(o => !o)}
        aria-label="Change color theme"
        aria-expanded={open}
        title="Change theme"
      >
        <CurrentIcon />
      </button>
      {open && (
        <div className="theme-picker-menu" role="menu">
          {options.map(({ value, label }) => {
            const Icon = icons[value]
            return (
              <button
                key={value}
                type="button"
                role="menuitem"
                className={`theme-picker-option${theme === value ? ' theme-picker-option--active' : ''}`}
                onClick={() => { onChange(value); setOpen(false) }}
              >
                <Icon /> {label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
