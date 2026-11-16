import { useState, type PointerEvent } from 'react'
import { ACCESSORIES, type AccessoryId } from '../lib/catalog'
import { Art } from './Art'

interface Props {
  onAdd: (type: AccessoryId) => void
  onStartDrag: (event: PointerEvent, type: AccessoryId) => void
}

const COLLAPSED_KEY = 'pegboard-accessories-collapsed'

export function Catalog({ onAdd, onStartDrag }: Props) {
  const [open, setOpen] = useState(() => localStorage.getItem(COLLAPSED_KEY) !== '1')
  function toggle() {
    setOpen(!open)
    try { localStorage.setItem(COLLAPSED_KEY, open ? '1' : '0') } catch { /* storage unavailable */ }
  }
  return (
    <section className={`panel catalog ${open ? '' : 'collapsed'}`} aria-label="Accessory catalog">
      <div className="panel-head">
        <h2>
          <button type="button" className="panel-toggle" aria-expanded={open} aria-controls="catalog-panel-body" onClick={toggle}>
            <span className="chevron" aria-hidden="true" />Accessories
          </button>
        </h2>
      </div>
      <div id="catalog-panel-body" className="panel-collapse" inert={!open}>
      <div className="panel-body">
      <div className="catalog-list">
        {ACCESSORIES.map(a => (
          <div key={a.id} className="catalog-card" data-type={a.id} role="group" aria-label={a.name} onPointerDown={event => onStartDrag(event, a.id)}>
            <div className="catalog-thumb"><Art type={a.id} /></div>
            <div className="catalog-info">
              <strong>{a.name}</strong>
              <small>{a.detail}</small>
            </div>
            <button className="add-button" type="button" aria-label={`Add ${a.name}`} onClick={() => onAdd(a.id)}>+</button>
          </div>
        ))}
      </div>
      </div>
      </div>
    </section>
  )
}
