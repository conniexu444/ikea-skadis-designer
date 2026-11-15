import { memo, type PointerEvent, type ReactNode } from 'react'
import { BOARD_SIZES, accessory, plural, type Board, type BoardSize, type Item } from '../lib/catalog'
import { HOLE_PITCH, allHoles, holePoint, itemPlacement, placement } from '../lib/holes'
import type { Drag } from '../hooks/useDrag'
import { Art } from './Art'

function Slot({ size, col, row, className }: { size: BoardSize; col: number; row: number; className?: string }) {
  const [x, y] = holePoint(size, col, row)
  return <rect x={x - 0.25} y={y - 0.75} width={0.5} height={1.5} rx={0.25} className={className} vectorEffect={className ? 'non-scaling-stroke' : undefined} />
}

function SvgLayer({ size, className, children }: { size: BoardSize; className: string; children: ReactNode }) {
  const [bw, bh] = BOARD_SIZES[size]
  return <svg className={className} viewBox={`0 0 ${bw} ${bh}`} preserveAspectRatio="none" aria-hidden="true">{children}</svg>
}

const Holes = memo(function Holes({ size }: { size: BoardSize }) {
  return <SvgLayer size={size} className="board-holes">{allHoles(size).map(([col, row]) => <Slot key={`${col},${row}`} size={size} col={col} row={row} />)}</SvgLayer>
})

interface Props {
  board: Board
  index: number
  items: Item[]
  selected: boolean
  selectedIds: Set<string>
  drag: Drag | null
  onGripDown: (event: PointerEvent, boardId: string) => void
  onItemDown: (event: PointerEvent, item: Item) => void
}

export function BoardView({ board, index, items, selected, selectedIds, drag, onGripDown, onItemDown }: Props) {
  const [bw, bh] = BOARD_SIZES[board.size]
  const moving = drag?.kind === 'board' && drag.id === board.id ? drag : null
  const group = drag?.kind === 'group' && drag.moved ? drag : null
  const groupBoard = group?.boardIds.includes(board.id) ?? false
  /** Selected pieces on a board that isn't moving shift hole by hole while the selection is dragged. */
  const shifting = (item: Item) => group !== null && !groupBoard && group.itemIds.includes(item.id)
  const x = moving?.preview.x ?? board.x + (groupBoard ? group!.dx : 0), y = moving?.preview.y ?? board.y + (groupBoard ? group!.dy : 0)
  const target = drag?.kind === 'piece' && drag.target?.board.id === board.id ? drag.target : null
  const preview = target && drag?.kind === 'piece' ? placement(board.size, drag.type, drag.rotation, target.col, target.row) : null
  const pct = (n: number, of: number) => `${n / of * 100}%`
  const cm = (n: number) => `calc(${n} * var(--cm))`

  return (
    <div
      className={`board-wrap ${selected ? 'selected-board' : ''} ${moving || groupBoard ? 'board-moving' : ''} ${moving?.preview.snapped ? 'board-snap' : ''}`}
      data-board-id={board.id}
      style={{ left: cm(x), top: cm(y), width: cm(bw), height: cm(bh) }}
      onPointerDown={event => { if (!(event.target as Element).closest('.board-item')) onGripDown(event, board.id) }}
    >
      <button className="board-grip" type="button" data-grip={board.id} aria-label={`Drag board ${index + 1} to move it`}>
        <span className="grip-dots" aria-hidden="true">⠿</span> Board {index + 1}
      </button>
      <div className={`board board-${board.color}`} role="group" aria-label={`Board ${index + 1}, ${bw} by ${bh} centimeters, ${board.color}`}>
        <span className="board-index">BOARD {String(index + 1).padStart(2, '0')}</span>
        <Holes size={board.size} />
        <div className="board-items">
          {items.map(item => {
            const a = accessory(item.type)!, [ix, iy, w, h] = itemPlacement(item, board.size).rect
            return (
              <div
                key={item.id}
                className={`board-item ${selectedIds.has(item.id) ? 'selected' : ''} ${drag?.kind === 'piece' && drag.id === item.id ? 'dragging' : ''}`}
                data-id={item.id} tabIndex={0} role="button"
                aria-label={`${a.name}, uses ${plural(a.pegs.length, 'hole')}, select and drag to move`}
                style={{ left: pct(ix, bw), top: pct(iy, bh), width: pct(w, bw), height: pct(h, bh), transform: shifting(item) ? `translate(${cm(group!.dc * HOLE_PITCH)}, ${cm(group!.dr * HOLE_PITCH)})` : undefined }}
                onPointerDown={event => onItemDown(event, item)}
              >
                <Art type={item.type} style={item.rotation === 90
                  ? { position: 'absolute', left: '50%', top: '50%', width: pct(a.w, w), height: pct(a.h, h), transform: 'translate(-50%,-50%) rotate(90deg)' }
                  : undefined} />
              </div>
            )
          })}
        </div>
        <SvgLayer size={board.size} className="board-pegs">
          {items.filter(item => item.type !== 'wall-mount' && !shifting(item)).flatMap(item => itemPlacement(item, board.size).holes.map(([col, row]) => (
            <Slot key={`${item.id}-${col},${row}`} size={board.size} col={col} row={row} className={`peg ${selectedIds.has(item.id) ? 'active' : ''}`} />
          )))}
          {preview && target && (
            <g className={`peg-preview ${target.issue ? 'blocked' : 'open'}`}>
              <rect className="preview-body" x={preview.rect[0]} y={preview.rect[1]} width={preview.rect[2]} height={preview.rect[3]} rx={0.6} vectorEffect="non-scaling-stroke" />
              {preview.holes.map(([col, row]) => <Slot key={`${col},${row}`} size={board.size} col={col} row={row} className="preview-peg" />)}
            </g>
          )}
        </SvgLayer>
      </div>
    </div>
  )
}
