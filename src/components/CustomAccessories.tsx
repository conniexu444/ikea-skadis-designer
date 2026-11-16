import { useState, type FormEvent, type PointerEvent } from 'react'
import type { Planner } from '../hooks/usePlanner'
import { CUSTOM_SIZE_LIMIT, MAX_CUSTOM, nextId, type Accessory, type AccessoryId, type PieceColor } from '../lib/catalog'
import { Art } from './Art'

interface Props {
  planner: Planner
  onStartDrag: (event: PointerEvent, type: AccessoryId) => void
}

interface Draft { id: AccessoryId | null; name: string; w: string; h: string; holes: string[]; rotates: boolean; color: PieceColor }

const COLLAPSED_KEY = 'pegboard-custom-collapsed'
const EMPTY: Draft = { id: null, name: '', w: '6', h: '6', holes: [], rotates: false, color: 'white' }

/** Holes a piece of this size could cover: 2 cm apart, staggered, centered in the piece. */
function lattice(w: number, h: number) {
  const nx = Math.max(1, Math.floor(w / 2)), ny = Math.max(1, Math.floor(h / 2))
  const mx = (w - 2 * (nx - 1)) / 2, my = (h - 2 * (ny - 1)) / 2
  const holes: { key: string; i: number; j: number; x: number; y: number }[] = []
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if ((i + j) % 2 === 0) holes.push({ key: `${i},${j}`, i, j, x: mx + 2 * i, y: my + 2 * j })
  return { holes, mx, my }
}

const size = (value: string) => Math.min(CUSTOM_SIZE_LIMIT, Math.max(1, Number(value) || 0))

function toPiece(draft: Draft): Accessory {
  const w = size(draft.w), h = size(draft.h), { holes } = lattice(w, h)
  const picked = holes.filter(hole => draft.holes.includes(hole.key)).sort((a, b) => a.j - b.j || a.i - b.i)
  const anchor = picked[0]
  return {
    id: draft.id ?? (`custom-${nextId().replace(/^piece-/, '')}` as AccessoryId),
    name: draft.name.trim().slice(0, 30), w, h,
    pegs: picked.map(hole => [hole.x - anchor.x, hole.y - anchor.y] as [number, number]),
    top: anchor.y, left: Math.min(...picked.map(hole => hole.x)),
    fixed: !draft.rotates, colors: draft.color === 'white' ? ['white', 'gray'] : ['gray', 'white'], detail: 'Custom accessory',
  }
}

function toDraft(piece: Accessory): Draft {
  const { mx, my } = lattice(piece.w, piece.h)
  const ax = (piece.left ?? 0) - Math.min(...piece.pegs.map(peg => peg[0])), ay = piece.top ?? 0
  const holes = piece.pegs.map(([x, y]) => `${Math.round((ax + x - mx) / 2)},${Math.round((ay + y - my) / 2)}`)
  return { id: piece.id, name: piece.name, w: String(piece.w), h: String(piece.h), holes, rotates: !piece.fixed, color: piece.colors?.[0] ?? 'gray' }
}

export function CustomAccessories({ planner, onStartDrag }: Props) {
  const [open, setOpen] = useState(() => localStorage.getItem(COLLAPSED_KEY) !== '1')
  const [draft, setDraft] = useState<Draft | null>(null)
  const pieces = planner.layout.custom ?? []

  function toggle() {
    setOpen(!open)
    try { localStorage.setItem(COLLAPSED_KEY, open ? '1' : '0') } catch { /* storage unavailable */ }
  }

  const w = draft ? size(draft.w) : 0, h = draft ? size(draft.h) : 0
  const grid = draft ? lattice(w, h) : null
  const holes = draft && grid ? draft.holes.filter(key => grid.holes.some(hole => hole.key === key)) : []
  const canSave = !!draft && draft.name.trim() !== '' && holes.length > 0

  function update(change: Partial<Draft>) { setDraft(current => current && { ...current, ...change }) }
  function flip(key: string) { update({ holes: holes.includes(key) ? holes.filter(entry => entry !== key) : [...holes, key] }) }
  function save(event: FormEvent) {
    event.preventDefault()
    if (!draft || !canSave) return
    planner.saveCustom(toPiece({ ...draft, holes }))
    setDraft(null)
  }

  return (
    <section className={`panel custom-panel ${open ? '' : 'collapsed'}`} aria-label="Custom accessories">
      <div className="panel-head">
        <h2>
          <button type="button" className="panel-toggle" aria-expanded={open} aria-controls="custom-panel-body" onClick={toggle}>
            <span className="chevron" aria-hidden="true" />Custom accessories
          </button>
        </h2>
      </div>
      <div id="custom-panel-body" className="panel-collapse" inert={!open}>
        <div className="panel-body">
          {pieces.length > 0 && (
            <div className="catalog-list">
              {pieces.map(piece => (
                <div
                  key={piece.id}
                  className="catalog-card custom-card"
                  data-type={piece.id}
                  role="group"
                  aria-label={piece.name}
                  onPointerDown={event => onStartDrag(event, piece.id)}
                >
                  <div className="catalog-thumb"><Art type={piece.id} /></div>
                  <div className="catalog-info"><strong>{piece.name}</strong></div>
                  <div className="custom-actions">
                    <button className="add-button" type="button" title="Edit" aria-label={`Edit ${piece.name}`} onClick={() => setDraft(toDraft(piece))}>✎</button>
                    <button className="add-button" type="button" title="Delete" aria-label={`Delete ${piece.name}`} onClick={() => { planner.removeCustom(piece.id); if (draft?.id === piece.id) setDraft(null) }}>×</button>
                    <button className="add-button" type="button" aria-label={`Add ${piece.name}`} onClick={() => planner.addAccessory(piece.id)}>+</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!draft && (
            <button type="button" className="button add-board" disabled={pieces.length >= MAX_CUSTOM} onClick={() => setDraft(EMPTY)}>+ New accessory</button>
          )}
          {draft && grid && (
            <form className="custom-form" aria-label={draft.id ? 'Edit accessory' : 'New accessory'} onSubmit={save}>
              <label className="field">
                <span className="field-label">Name</span>
                <input type="text" value={draft.name} maxLength={30} placeholder="e.g. Shelf" autoFocus onChange={event => update({ name: event.target.value })} />
              </label>
              <div className="field">
                <span className="field-label">Size <small>cm</small></span>
                <div className="custom-size">
                  <label>Width<input type="number" min={1} max={CUSTOM_SIZE_LIMIT} step={0.5} value={draft.w} onChange={event => update({ w: event.target.value })} /></label>
                  <label>Height<input type="number" min={1} max={CUSTOM_SIZE_LIMIT} step={0.5} value={draft.h} onChange={event => update({ h: event.target.value })} /></label>
                </div>
              </div>
              <div className="field">
                <span className="field-label">Holes <small>click the ones it clips into</small></span>
                <svg className="peg-picker" viewBox={`-0.4 -0.4 ${w + 0.8} ${h + 0.8}`} role="group" aria-label="Holes it uses">
                  <rect x="0" y="0" width={w} height={h} rx={Math.min(w, h) * 0.12} fill="var(--surface)" stroke="var(--line-strong)" strokeWidth=".08" />
                  {grid.holes.map(hole => {
                    const picked = holes.includes(hole.key)
                    return (
                      <g
                        key={hole.key}
                        className={`pick-hole ${picked ? 'picked' : ''}`}
                        role="checkbox"
                        aria-checked={picked}
                        aria-label={`Hole ${hole.i + 1}, ${hole.j + 1}`}
                        tabIndex={0}
                        onClick={() => flip(hole.key)}
                        onKeyDown={event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); flip(hole.key) } }}
                      >
                        <circle className="ring" cx={hole.x} cy={hole.y} r=".9" />
                        <rect className="slot" x={hole.x - 0.28} y={hole.y - 0.7} width=".56" height="1.4" rx=".28" />
                      </g>
                    )
                  })}
                </svg>
              </div>
              <div className="field">
                <span className="field-label">Color</span>
                <div className="segmented" role="group" aria-label="Accessory color">
                  {(['white', 'gray'] as const).map(color => (
                    <button key={color} type="button" className={draft.color === color ? 'active' : ''} aria-pressed={draft.color === color} onClick={() => update({ color })}>
                      {color === 'white' ? 'White' : 'Dark gray'}
                    </button>
                  ))}
                </div>
              </div>
              <label className="custom-check">
                <input type="checkbox" checked={draft.rotates} onChange={event => update({ rotates: event.target.checked })} />Can rotate
              </label>
              <div className="custom-buttons">
                <button type="button" className="button" onClick={() => setDraft(null)}>Cancel</button>
                <button type="submit" className="button button-save" disabled={!canSave}>Save</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
