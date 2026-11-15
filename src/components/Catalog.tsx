import type { PointerEvent } from 'react'
import { ACCESSORIES, plural, type AccessoryId } from '../lib/catalog'
import { Art } from './Art'

interface Props {
  onAdd: (type: AccessoryId) => void
  onStartDrag: (event: PointerEvent, type: AccessoryId) => void
}

export function Catalog({ onAdd, onStartDrag }: Props) {
  return (
    <section className="panel catalog" aria-label="Accessory catalog">
      <div className="sidebar-head">
        <h2>Accessories</h2>
        <span className="count">{plural(ACCESSORIES.length, 'piece')}</span>
      </div>
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
    </section>
  )
}
