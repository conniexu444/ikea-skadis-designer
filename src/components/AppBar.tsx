import { useState, type CSSProperties } from 'react'

const BRAND_WORDS = ['Pegboard', 'Designer']
const THEME_KEY = 'pegboard-theme'

function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark')
  function toggle() {
    const next = dark ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
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
          type="button" className="icon-button theme-toggle" aria-pressed={dark}
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'} aria-label="Dark mode" onClick={toggleTheme}
        >
          {dark
            ? <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
            : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" /></svg>}
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
