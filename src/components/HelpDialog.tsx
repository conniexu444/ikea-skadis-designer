import { useEffect, useRef } from 'react'

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
      <ol>
        <li><b>Arrange your boards.</b> Drag a board anywhere a piece isn’t; edges snap together when they get close.</li>
        <li><b>Mount them.</b> Put wall mounts on the holes that will hold each board to the wall.</li>
        <li><b>Add accessories.</b> Drag pieces onto the board or press +. Pieces snap to holes, each hole holds one thing, and pieces can hang past the board edge.</li>
        <li><b>Fine-tune.</b> Select a piece to rotate, copy, or remove it. Arrow keys move it hole by hole. Ctrl/⌘+C and Ctrl/⌘+V copy and paste a selected piece or board.</li>
        <li><b>Look closer.</b> Pinch the trackpad to zoom, and scroll or drag the canvas to move around.</li>
        <li><b>Keep it.</b> Your layout saves in this browser. Click <b>Save</b> to download it as a PNG.</li>
      </ol>
      <button className="button button-primary" type="button" onClick={onClose}>Start planning</button>
    </dialog>
  )
}
