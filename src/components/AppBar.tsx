interface Props {
  name: string
  saveFailed: boolean
  canUndo: boolean
  canRedo: boolean
  onRename: (name: string) => void
  onUndo: () => void
  onRedo: () => void
  onDownload: () => void
}

export function AppBar({ name, saveFailed, canUndo, canRedo, onRename, onUndo, onRedo, onDownload }: Props) {
  return (
    <header className="appbar">
      <a className="brand" href="./" aria-label="SKÅDIS Studio home">
        <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /><i /></span>
        <span className="brand-name">SKÅDIS <span>Studio</span></span>
      </a>
      <div className="layout-meta">
        <label className="visually-hidden" htmlFor="projectName">Layout name</label>
        {/* Keyed by name so undo/redo resets the field; edits commit on blur or Enter. */}
        <input
          key={name} id="projectName" className="name-input" type="text" maxLength={60} defaultValue={name} spellCheck={false}
          onBlur={event => onRename(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }}
        />
        {saveFailed && <span className="save-status" role="status">Storage unavailable — download your layout</span>}
      </div>
      <div className="appbar-actions">
        <div className="button-group" role="group" aria-label="History">
          <button type="button" className="icon-button" title="Undo (Ctrl+Z)" aria-label="Undo" disabled={!canUndo} onClick={onUndo}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7 4 12l5 5" /><path d="M4 12h11a5 5 0 0 1 0 10h-3" /></svg>
          </button>
          <button type="button" className="icon-button" title="Redo (Ctrl+Shift+Z)" aria-label="Redo" disabled={!canRedo} onClick={onRedo}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 7 5 5-5 5" /><path d="M20 12H9a5 5 0 0 0 0 10h3" /></svg>
          </button>
        </div>
        <button type="button" className="button button-primary" onClick={onDownload}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11" /><path d="m7 10 5 5 5-5" /><path d="M5 20h14" /></svg>
          <span>Download PNG</span>
        </button>
      </div>
    </header>
  )
}
