import { useState, type FormEvent, type PointerEvent } from 'react'
import type { Planner } from '../hooks/usePlanner'
import { CUSTOM_SIZE_LIMIT, MAX_CUSTOM, nextId, type Accessory, type AccessoryId, type PieceColor } from '../lib/catalog'
import { Art } from './Art'
import { useUnit, type Unit } from '../hooks/useUnit'
import { UnitSwitch } from './UnitSwitch'

interface Props {
  planner: Planner
  onStartDrag: (event: PointerEvent, type: AccessoryId) => void
}

interface Dim { value: string; unit: Unit }
interface Draft { id: AccessoryId | null; name: string; w: Dim; h: Dim; holes: string[]; rotates: boolean; color: PieceColor }

const COLLAPSED_KEY = 'pegboard-custom-collapsed'
const GRID = 9
/** The picker's mini board: a 9×9 staggered grid of holes 2 cm apart. */
const GRID_HOLES = Array.from({ length: GRID * GRID }, (_, n) => ({ i: n % GRID, j: Math.floor(n / GRID) }))
  .filter(({ i, j }) => (i + j) % 2 === 0)
  .map(({ i, j }) => ({ key: `${i},${j}`, i, j, x: 2 * i, y: 2 * j }))
const GRID_SPAN = 2 * (GRID - 1)
const HOLE_PAD = 1.6

const toCm = ({ value, unit }: Dim) => Math.min(CUSTOM_SIZE_LIMIT, Math.max(1, (Number(value) || 0) * (unit === 'in' ? 2.54 : 1)))
const fromCm = (cm: number, unit: Unit): Dim => ({ value: String(Math.round((unit === 'in' ? cm / 2.54 : cm) * 10) / 10), unit })
const exact = (cm: number): Dim => ({ value: String(Math.round(cm * 100) / 100), unit: 'cm' })
/** A size as typed, or converted when the other unit is showing. */
const shown = (dim: Dim, unit: Unit) => dim.unit === unit ? dim.value : fromCm(toCm(dim), unit).value

/** The piece outline, grown if needed so it covers every picked hole, centered on them. */
function outline(draft: Draft, keys: string[]) {
  const picked = GRID_HOLES.filter(hole => keys.includes(hole.key))
  const xs = picked.length ? picked.map(hole => hole.x) : [GRID_SPAN / 2], ys = picked.length ? picked.map(hole => hole.y) : [GRID_SPAN / 2]
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
  const w = Math.max(toCm(draft.w), maxX - minX + HOLE_PAD), h = Math.max(toCm(draft.h), maxY - minY + HOLE_PAD)
  return { picked, w, h, x: (minX + maxX - w) / 2, y: (minY + maxY - h) / 2 }
}

function toPiece(draft: Draft): Accessory {
  const { picked, w, h, x, y } = outline(draft, draft.holes)
  const sorted = [...picked].sort((a, b) => a.j - b.j || a.i - b.i), anchor = sorted[0]
  return {
    id: draft.id ?? (`custom-${nextId().replace(/^piece-/, '')}` as AccessoryId),
    name: draft.name.trim().slice(0, 30), w, h,
    pegs: sorted.map(hole => [hole.x - anchor.x, hole.y - anchor.y] as [number, number]),
    top: anchor.y - y, left: Math.min(...sorted.map(hole => hole.x)) - x,
    fixed: !draft.rotates, colors: draft.color === 'white' ? ['white', 'gray'] : ['gray', 'white'], detail: 'Custom accessory',
  }
}

function toDraft(piece: Accessory): Draft {
  const cells = piece.pegs.map(([x, y]) => [Math.round(x / 2), Math.round(y / 2)])
  const is = cells.map(cell => cell[0]), js = cells.map(cell => cell[1])
  let ai = Math.round((GRID - 1 - Math.min(...is) - Math.max(...is)) / 2)
  const aj = Math.round((GRID - 1 - Math.min(...js) - Math.max(...js)) / 2)
  if (Math.abs(ai + aj) % 2 === 1) ai += ai + Math.min(...is) > 0 ? -1 : 1
  const holes = cells.map(([i, j]) => `${ai + i},${aj + j}`).filter(key => GRID_HOLES.some(hole => hole.key === key))
  return { id: piece.id, name: piece.name, w: exact(piece.w), h: exact(piece.h), holes, rotates: !piece.fixed, color: piece.colors?.[0] ?? 'gray' }
}

export function CustomAccessories({ planner, onStartDrag }: Props) {
  const [open, setOpen] = useState(() => localStorage.getItem(COLLAPSED_KEY) !== '1')
  const unit = useUnit()
  const [draft, setDraft] = useState<Draft | null>(null)
  const pieces = planner.layout.custom ?? []

  function toggle() {
    setOpen(!open)
    try { localStorage.setItem(COLLAPSED_KEY, open ? '1' : '0') } catch { /* storage unavailable */ }
  }

  const holes = draft ? draft.holes.filter(key => GRID_HOLES.some(hole => hole.key === key)) : []
  const shape = draft && outline(draft, holes)
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
            <button type="button" className="button add-board" disabled={pieces.length >= MAX_CUSTOM} onClick={() => setDraft({ id: null, name: '', w: exact(6), h: exact(6), holes: [], rotates: false, color: 'white' })}>+ New accessory</button>
          )}
          {draft && shape && (
            <form className="custom-form" aria-label={draft.id ? 'Edit accessory' : 'New accessory'} onSubmit={save}>
              <label className="field">
                <span className="field-label">Name</span>
                <input type="text" value={draft.name} maxLength={30} placeholder="e.g. Shelf" autoFocus onChange={event => update({ name: event.target.value })} />
              </label>
              <div className="field">
                <div className="field-head"><span className="field-label">Size</span><UnitSwitch /></div>
                <div className="custom-size">
                  <label>Width<input type="number" min={unit === 'in' ? 0.4 : 1} max={unit === 'in' ? 15.7 : CUSTOM_SIZE_LIMIT} step={unit === 'in' ? 0.1 : 0.5} value={shown(draft.w, unit)} onChange={event => update({ w: { value: event.target.value, unit } })} /></label>
                  <label>Height<input type="number" min={unit === 'in' ? 0.4 : 1} max={unit === 'in' ? 15.7 : CUSTOM_SIZE_LIMIT} step={unit === 'in' ? 0.1 : 0.5} value={shown(draft.h, unit)} onChange={event => update({ h: { value: event.target.value, unit } })} /></label>
                </div>
              </div>
              <div className="field">
                <span className="field-label">Holes <small>click the ones it clips into</small></span>
                <svg className="peg-picker" viewBox={`-1.2 -1.2 ${GRID_SPAN + 2.4} ${GRID_SPAN + 2.4}`} role="group" aria-label="Holes it uses">
                  <rect className="pick-outline" x={shape.x} y={shape.y} width={shape.w} height={shape.h} rx={Math.min(shape.w, shape.h) * 0.12} />
                  {GRID_HOLES.map(hole => {
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
