import { useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { BOARD_SIZES, type AccessoryId, type Board, type Item, type Rotation } from '../lib/catalog'
import { anchorFor, geometry, moveEnd, nearestHole, placementIssue, usedHoles, type Hole, type PlacementIssue } from '../lib/holes'
import { holeDelta, snapBoard } from '../lib/layout'
import type { Planner } from './usePlanner'
import { useLatest } from './useLatest'

export interface DropTarget { board: Board; col: number; row: number; issue: PlacementIssue | null }
export interface PieceDrag {
  kind: 'piece'; type: AccessoryId; id: string | null; rotation: Rotation; end?: Hole
  /** Piece size in cm and the zoom it was picked up at, for sizing the ghost. */
  w: number; h: number; pxPerCm: number
  clientX: number; clientY: number; target: DropTarget | null
}
/** A press that moves less than this is a click, so it selects the board without snapping it. */
const DRAG_THRESHOLD_PX = 4

export interface BoardDrag { kind: 'board'; id: string; startX: number; startY: number; x: number; y: number; moved: boolean; preview: { x: number; y: number; snapped: boolean } }
/** Moving a box selection: boards shift by (dx, dy) cm, loose pieces by (dc, dr) holes. */
export interface GroupDrag {
  kind: 'group'; startX: number; startY: number; dx: number; dy: number; dc: number; dr: number; moved: boolean
  boardIds: string[]; itemIds: string[]; origin: { kind: 'board' | 'item'; id: string }
}
/** Dragging one end of a stretchy piece (0 = anchor peg) to another hole on its board. */
export interface EndDrag { kind: 'end'; id: string; which: 0 | 1; target: ReturnType<typeof moveEnd> | null }
export type Drag = PieceDrag | BoardDrag | GroupDrag | EndDrag

/** Dragging pieces from the catalog or between holes, and dragging boards by their handle. */
export function useDrag(planner: Planner, pxPerCm: number) {
  const [drag, setDrag] = useState<Drag | null>(null)
  const latest = useLatest({ drag, planner, pxPerCm })

  function dropTarget(clientX: number, clientY: number, piece: Pick<PieceDrag, 'type' | 'rotation' | 'id' | 'w' | 'h' | 'end'>): DropTarget | null {
    const { layout } = latest.current.planner
    let best: { target: DropTarget; inside: boolean } | null = null
    for (const board of layout.boards) {
      const rect = document.querySelector(`[data-board-id="${board.id}"] .board-items`)?.getBoundingClientRect()
      if (!rect) continue
      const [bw, bh] = BOARD_SIZES[board.size], reachX = piece.w / 2 * rect.width / bw, reachY = piece.h / 2 * rect.height / bh
      // A piece can hang off the board, so it still targets the board while its pegs could reach a hole.
      if (clientX < rect.left - reachX || clientX > rect.right + reachX || clientY < rect.top - reachY || clientY > rect.bottom + reachY) continue
      const inside = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
      if (best && (best.inside || !inside)) continue
      const x = (clientX - rect.left) / rect.width * bw - piece.w / 2, y = (clientY - rect.top) / rect.height * bh - piece.h / 2
      const [col, row] = anchorFor(board.size, piece.type, piece.rotation, x, y, piece.end)
      best = { inside, target: { board, col, row, issue: placementIssue(board, piece.type, piece.rotation, col, row, usedHoles(layout.items, board, piece.id), piece.end) } }
    }
    return best?.target ?? null
  }

  function endTarget(drag: EndDrag, clientX: number, clientY: number) {
    const { layout } = latest.current.planner, item = layout.items.find(entry => entry.id === drag.id)
    const board = item && layout.boards.find(entry => entry.id === item.boardId)
    const rect = board && document.querySelector(`[data-board-id="${board.id}"] .board-items`)?.getBoundingClientRect()
    if (!item || !board || !rect) return null
    const [bw, bh] = BOARD_SIZES[board.size]
    const hole = nearestHole(board.size, (clientX - rect.left) / rect.width * bw, (clientY - rect.top) / rect.height * bh)
    return moveEnd(board, layout.items, item, drag.which, hole)
  }

  function startEndDrag(event: ReactPointerEvent, item: Item, which: 0 | 1) {
    if (event.button !== 0) return
    event.preventDefault(); event.stopPropagation()
    planner.selectItem(item.id)
    setDrag({ kind: 'end', id: item.id, which, target: null })
  }

  function startGroupDrag(event: ReactPointerEvent, origin: GroupDrag['origin']) {
    const group = planner.groupSelection!
    event.preventDefault()
    setDrag({ kind: 'group', startX: event.clientX, startY: event.clientY, dx: 0, dy: 0, dc: 0, dr: 0, moved: false, boardIds: group.boardIds, itemIds: group.itemIds, origin })
  }

  function startPieceDrag(event: ReactPointerEvent, type: AccessoryId, id: string | null = null) {
    if (event.button !== 0 || (event.target as Element).closest('button')) return
    if (id && planner.groupSelection?.itemIds.includes(id)) { startGroupDrag(event, { kind: 'item', id }); return }
    event.preventDefault()
    const item = id ? planner.layout.items.find(entry => entry.id === id) : null, rotation = item?.rotation ?? 0, end = item?.end
    const [, , w, h] = geometry(type, rotation, end).rect
    const piece = { type, id, rotation, end, w, h }
    planner.selectItem(id)
    setDrag({ kind: 'piece', ...piece, pxPerCm, clientX: event.clientX, clientY: event.clientY, target: dropTarget(event.clientX, event.clientY, piece) })
  }

  function startBoardDrag(event: ReactPointerEvent, id: string) {
    if (event.button !== 0) return
    if (planner.groupSelection?.boardIds.includes(id)) { startGroupDrag(event, { kind: 'board', id }); return }
    event.preventDefault()
    const board = planner.layout.boards.find(entry => entry.id === id)
    if (!board) return
    planner.selectBoard(id)
    setDrag({ kind: 'board', id, startX: event.clientX, startY: event.clientY, x: board.x, y: board.y, moved: false, preview: { x: board.x, y: board.y, snapped: false } })
  }

  const dragging = drag !== null
  useEffect(() => {
    if (!dragging) return
    const onMove = (event: PointerEvent) => {
      const { drag, planner, pxPerCm } = latest.current
      if (!drag) return
      if (drag.kind === 'end') {
        setDrag({ ...drag, target: endTarget(drag, event.clientX, event.clientY) })
        return
      }
      if (drag.kind === 'piece') {
        setDrag({ ...drag, clientX: event.clientX, clientY: event.clientY, target: dropTarget(event.clientX, event.clientY, drag) })
        return
      }
      if (drag.kind === 'group') {
        const dx = (event.clientX - drag.startX) / pxPerCm, dy = (event.clientY - drag.startY) / pxPerCm, [dc, dr] = holeDelta(dx, dy)
        const half = (n: number) => Math.round(n * 2) / 2
        setDrag({ ...drag, dx: half(dx), dy: half(dy), dc, dr, moved: drag.moved || Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 3 })
        return
      }
      if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) <= DRAG_THRESHOLD_PX) return
      const board = planner.layout.boards.find(entry => entry.id === drag.id)!
      const preview = snapBoard(planner.layout.boards, board, drag.x + (event.clientX - drag.startX) / pxPerCm, drag.y + (event.clientY - drag.startY) / pxPerCm)
      setDrag({ ...drag, moved: true, preview })
    }
    const onUp = (event: PointerEvent) => {
      const { drag, planner } = latest.current
      setDrag(null)
      if (!drag) return
      if (drag.kind === 'group') {
        if (drag.moved) planner.moveGroup(drag.dx, drag.dy, drag.dc, drag.dr)
        else if (drag.origin.kind === 'item') planner.selectItem(drag.origin.id)
        else planner.selectBoard(drag.origin.id)
        return
      }
      if (drag.kind === 'end') {
        const target = endTarget(drag, event.clientX, event.clientY)
        if (target && !target.issue) planner.stretchItem(drag.id, target.col, target.row, target.end)
        return
      }
      if (drag.kind === 'board') {
        if (drag.moved) planner.moveBoard(drag.id, drag.preview.x, drag.preview.y)
        return
      }
      const target = dropTarget(event.clientX, event.clientY, drag)
      if (!target) return
      if (target.issue) return
      if (drag.id) planner.moveItem(drag.id, target.board.id, target.col, target.row)
      else planner.addAccessory(drag.type, [target.col, target.row], target.board.id)
    }
    const onCancel = () => setDrag(null)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    document.body.classList.add('dragging')
    return () => {
      document.body.classList.remove('dragging')
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
    // dropTarget only reads through `latest`, so the listeners only need to change when a drag starts or ends.
  }, [dragging]) // eslint-disable-line react-hooks/exhaustive-deps

  return { drag, startPieceDrag, startBoardDrag, startEndDrag }
}
