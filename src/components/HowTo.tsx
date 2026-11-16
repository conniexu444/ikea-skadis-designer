import { useState } from 'react'
import { HowToSteps } from './HowToSteps'

const COLLAPSED_KEY = 'pegboard-how-to-collapsed'

export function HowTo() {
  const [open, setOpen] = useState(() => localStorage.getItem(COLLAPSED_KEY) === '0')
  function toggle() {
    setOpen(!open)
    try { localStorage.setItem(COLLAPSED_KEY, open ? '1' : '0') } catch { /* storage unavailable */ }
  }
  return (
    <section className={`panel how-to ${open ? '' : 'collapsed'}`} aria-label="How to">
      <div className="panel-head">
        <h2>
          <button type="button" className="panel-toggle" aria-expanded={open} aria-controls="how-to-panel-body" onClick={toggle}>
            <span className="chevron" aria-hidden="true" />How to
          </button>
        </h2>
      </div>
      <div id="how-to-panel-body" className="panel-collapse" inert={!open}>
        <div className="panel-body">
          <HowToSteps />
        </div>
      </div>
    </section>
  )
}
