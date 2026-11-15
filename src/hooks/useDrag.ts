import { useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { BOARD_SIZES, type AccessoryId, type Board, type Rotation } from '../lib/catalog'
import { anchorFor, geometry, placementIssue, usedHoles, type PlacementIssue } from '../lib/holes'
import { snapBoard } from '../lib/layout'
import type { Planner } from './usePlanner'
import { useLatest } from './useLatest'

const ISSUE_MESSAGES: Record<PlacementIssue, string> = {
  taken: 'Those holes are already in use — each hole can only hold one thing',
  edge: 'That piece doesn’t fit there on the board',
}

export interface DropTarget { board: Board; col: number; row: number; issue: PlacementIssue | null }
export interface PieceDrag {
  kind: 'piece'; type: AccessoryId; id: string | null; rotation: Rotation
  /** Piece size in cm and the zoom it was picked up at, for sizing the ghost. */
  w: number; h: number; pxPerCm: number
  clientX: number; clientY: number; target: DropTarget | null
}
export interface BoardDrag { kind: 'board'; id: string; startX: number; startY: number; x: number; y: number; preview: { x: number; y: number; snapped: boolean } }
export type Drag = PieceDrag | BoardDrag

/** Dragging pieces from the catalog or between holes, and dragging boards by their handle. */
export function useDrag(planner: Planner, pxPerCm: number) {
  const [drag, setDrag] = useState<Drag | null>(null)
  const latest = useLatest({ drag, planner, pxPerCm })

  function dropTarget(clientX: number, clientY: number, piece: Pick<PieceDrag, 'type' | 'rotation' | 'id' | 'w' | 'h'>): DropTarget | null {
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
      const [col, row] = anchorFor(board.size, piece.type, piece.rotation, x, y)
      best = { inside, target: { board, col, row, issue: placementIssue(board, piece.type, piece.rotation, col, row, usedHoles(layout.items, board, piece.id)) } }
    }
    return best?.target ?? null
  }

  function startPieceDrag(event: ReactPointerEvent, type: AccessoryId, id: string | null = null) {
    if (event.button !== 0 || (event.target as Element).closest('button')) return
    event.preventDefault()
    const item = id ? planner.layout.items.find(entry => entry.id === id) : null, rotation = item?.rotation ?? 0
    const [, , w, h] = geometry(type, rotation).rect
    const piece = { type, id, rotation, w, h }
    planner.selectItem(id)
    setDrag({ kind: 'piece', ...piece, pxPerCm, clientX: event.clientX, clientY: event.clientY, target: dropTarget(event.clientX, event.clientY, piece) })
  }

  function startBoardDrag(event: ReactPointerEvent, id: string) {
    if (event.button !== 0) return
    event.preventDefault()
    const board = planner.layout.boards.find(entry => entry.id === id)
    if (!board) return
    planner.selectBoard(id)
    setDrag({ kind: 'board', id, startX: event.clientX, startY: event.clientY, x: board.x, y: board.y, preview: { x: board.x, y: board.y, snapped: false } })
  }

  const dragging = drag !== null
  useEffect(() => {
    if (!dragging) return
    const onMove = (event: PointerEvent) => {
      const { drag, planner, pxPerCm } = latest.current
      if (!drag) return
      if (drag.kind === 'piece') {
        setDrag({ ...drag, clientX: event.clientX, clientY: event.clientY, target: dropTarget(event.clientX, event.clientY, drag) })
        return
      }
      const board = planner.layout.boards.find(entry => entry.id === drag.id)!
      const preview = snapBoard(planner.layout.boards, board, drag.x + (event.clientX - drag.startX) / pxPerCm, drag.y + (event.clientY - drag.startY) / pxPerCm)
      setDrag({ ...drag, preview })
    }
    const onUp = (event: PointerEvent) => {
      const { drag, planner } = latest.current
      setDrag(null)
      if (!drag) return
      if (drag.kind === 'board') {
        if (!planner.moveBoard(drag.id, drag.preview.x, drag.preview.y)) planner.notify('Boards cannot overlap — drag near an edge to snap them together')
        return
      }
      const target = dropTarget(event.clientX, event.clientY, drag)
      if (!target) return
      if (target.issue) { planner.notify(ISSUE_MESSAGES[target.issue]); return }
      if (drag.id) planner.moveItem(drag.id, target.board.id, target.col, target.row)
      else planner.addAccessory(drag.type, [target.col, target.row], target.board.id)
    }
    const onCancel = () => setDrag(null)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
    // dropTarget only reads through `latest`, so the listeners only need to change when a drag starts or ends.
  }, [dragging]) // eslint-disable-line react-hooks/exhaustive-deps

  return { drag, startPieceDrag, startBoardDrag }
}
