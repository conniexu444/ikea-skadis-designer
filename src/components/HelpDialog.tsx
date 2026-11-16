import { useEffect, useRef } from 'react'
import { HowToSteps } from './HowToSteps'

export function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])
  return (
    <dialog ref={ref} className="help-dialog" onClose={onClose} onClick={event => { if (event.target === ref.current) onClose() }}>
      <button className="dialog-close icon-button" type="button" aria-label="Close" onClick={onClose}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
      </button>
      <h2>Plan it before you drill.</h2>
      <p className="dialog-lead">Pegboard Designer lays out real SKÅDIS hole grids so you can see exactly what fits.</p>
      <HowToSteps />
      <button className="button button-primary" type="button" onClick={onClose}>Start planning</button>
    </dialog>
  )
}
