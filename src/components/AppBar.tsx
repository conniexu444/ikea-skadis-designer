import { useState, type CSSProperties } from 'react'

const BRAND_WORDS = ['Pegboard', 'Designer']
const THEME_KEY = 'pegboard-theme'
const THEME_FADE_MS = 500
let fadeTimer: ReturnType<typeof setTimeout> | undefined

function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark')
  function toggle() {
    const next = dark ? 'light' : 'dark', root = document.documentElement
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.classList.add('theme-fading')
      clearTimeout(fadeTimer)
      fadeTimer = setTimeout(() => root.classList.remove('theme-fading'), THEME_FADE_MS)
    }
    root.dataset.theme = next
    try { localStorage.setItem(THEME_KEY, next) } catch { /* storage unavailable */ }
    setDark(!dark)
  }
  return [dark, toggle] as const
}

interface Props {
  saveFailed: boolean
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onDownload: () => void
}

export function AppBar({ saveFailed, canUndo, canRedo, onUndo, onRedo, onDownload }: Props) {
  const [dark, toggleTheme] = useTheme()
  return (
    <header className="appbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /><i /></span>
        <span className="brand-name">
          <span className="visually-hidden">Pegboard Designer</span>
          <span aria-hidden="true">
            {BRAND_WORDS.map((word, w) => (
              <span key={word} className="brand-word">
                {[...word].map((ch, c) => (
                  <span key={c} className="brand-char" style={{ '--i': w * 9 + c } as CSSProperties}>{ch}</span>
                ))}
              </span>
            ))}
          </span>
        </span>
      </div>
      <div className="layout-meta">
        {saveFailed && <span className="save-status" role="status">Storage unavailable — download your layout</span>}
      </div>
      <div className="appbar-actions">
        <button
          type="button" role="switch" className="theme-switch" aria-checked={dark} aria-label="Dark mode"
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={toggleTheme}
        >
          <span className="theme-switch-knob" aria-hidden="true" />
        </button>
        <div className="button-group" role="group" aria-label="History">
          <button type="button" className="icon-button" title="Undo (Ctrl+Z)" aria-label="Undo" disabled={!canUndo} onClick={onUndo}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7 4 12l5 5" /><path d="M4 12h11a5 5 0 0 1 0 10h-3" /></svg>
          </button>
          <button type="button" className="icon-button" title="Redo (Ctrl+Shift+Z)" aria-label="Redo" disabled={!canRedo} onClick={onRedo}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 7 5 5-5 5" /><path d="M20 12H9a5 5 0 0 0 0 10h3" /></svg>
          </button>
        </div>
        <button type="button" className="button button-primary button-save" title="Save as PNG image" onClick={onDownload}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h11l4 4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 1-2Z" /><path d="M8 3v5h7V3" /><path d="M7 21v-7h10v7" /></svg>
          <span>Save</span>
        </button>
      </div>
    </header>
  )
}
