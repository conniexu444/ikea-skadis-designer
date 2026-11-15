import { useState, type PointerEvent } from 'react'
import { ACCESSORIES, FILTERS, plural, type AccessoryGroup, type AccessoryId } from '../lib/catalog'
import { Art } from './Art'

interface Props {
  onAdd: (type: AccessoryId) => void
  onStartDrag: (event: PointerEvent, type: AccessoryId) => void
}

export function Catalog({ onAdd, onStartDrag }: Props) {
  const [filter, setFilter] = useState<AccessoryGroup | 'all'>('all')
  const [query, setQuery] = useState('')
  const q = query.toLowerCase().trim()
  const visible = ACCESSORIES.filter(a => (filter === 'all' || a.group === filter) && `${a.name} ${a.detail}`.toLowerCase().includes(q))
  return (
    <section className="panel catalog" aria-label="Accessory catalog">
      <div className="sidebar-head">
        <h2>Accessories</h2>
        <span className="count">{plural(visible.length, 'piece')}</span>
      </div>
      <div className="search-wrap">
        <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></svg>
        <input type="search" placeholder="Search accessories" aria-label="Search accessories" value={query} onChange={event => setQuery(event.target.value)} />
      </div>
      <div className="filter-row" role="group" aria-label="Filter accessories">
        {FILTERS.map(entry => (
          <button key={entry.id} className={`filter ${filter === entry.id ? 'active' : ''}`} type="button" onClick={() => setFilter(entry.id)}>{entry.label}</button>
        ))}
      </div>
      <div className="catalog-list">
        {visible.length ? visible.map(a => (
          <div key={a.id} className="catalog-card" data-type={a.id} role="group" aria-label={a.name} onPointerDown={event => onStartDrag(event, a.id)}>
            <div className="catalog-thumb"><Art type={a.id} /></div>
            <div className="catalog-info">
              <strong>{a.name}</strong>
              <small>{a.detail}</small>
            </div>
            <button className="add-button" type="button" aria-label={`Add ${a.name}`} onClick={() => onAdd(a.id)}>+</button>
          </div>
        )) : <p className="catalog-empty">No accessories match that search.</p>}
      </div>
      <p className="sidebar-note">Drag a piece onto a board, or press <kbd>+</kbd> to drop it in the first free spot.</p>
    </section>
  )
}
