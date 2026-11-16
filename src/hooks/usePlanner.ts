import { useEffect, useState } from 'react'
import { accessory, nextId, plural, type AccessoryId, type Board, type BoardSize, type Finish, type Item, type Layout } from '../lib/catalog'
import { findSpot, placementIssue, usedHoles, type Hole } from '../lib/holes'
import {
  MAX_BOARDS, STORAGE_KEY, boardRectOverlaps, freeBoardSpot, groupPasteOffset, overlapsAny, readInitialLayout, refitItems, separateBoards,
  type AreaSelection,
} from '../lib/layout'

const HISTORY_LIMIT = 80

interface History { past: Layout[]; present: Layout; future: Layout[] }
export interface ToastMessage { id: number; text: string }
type Clipboard = { kind: 'item'; item: Item } | { kind: 'board'; board: Board; items: Item[] } | { kind: 'group'; boards: Board[]; items: Item[] }

/** Layout state with undo/redo, persistence and every editing action. Each edit is one undo step. */
export function usePlanner() {
  const [history, setHistory] = useState<History>(() => ({ past: [], present: readInitialLayout(), future: [] }))
  const [firstVisit] = useState(() => !localStorage.getItem(STORAGE_KEY) && !location.hash.startsWith('#layout='))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [chosenBoardId, setChosenBoardId] = useState<string | null>(null)
  const [boardHighlighted, setBoardHighlighted] = useState(false)
  const [areaState, setArea] = useState<AreaSelection | null>(null)
  const [clipboard, setClipboard] = useState<Clipboard | null>(null)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [saveFailed, setSaveFailed] = useState(false)
  const layout = history.present
  const selectedBoardId = layout.boards.some(board => board.id === chosenBoardId) ? chosenBoardId! : layout.boards[0].id
  const currentBoard = layout.boards.find(board => board.id === selectedBoardId)!
  const selectedItem = layout.items.find(item => item.id === selectedId) ?? null
  const area = areaState && {
    boardIds: areaState.boardIds.filter(id => layout.boards.some(board => board.id === id)),
    itemIds: areaState.itemIds.filter(id => layout.items.some(item => item.id === id)),
  }
  const groupSelection = area && (area.boardIds.length || area.itemIds.length) ? area : null
  const selectedItemIds = new Set(groupSelection ? groupSelection.itemIds : selectedId ? [selectedId] : [])
  const highlightedBoardIds = new Set(groupSelection ? groupSelection.boardIds : boardHighlighted ? [selectedBoardId] : [])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(layout)) }
    // Storage is the external system here; a failed write is only known once we try it.
    // oxlint-disable-next-line react/set-state-in-effect
    catch { setSaveFailed(true) }
  }, [layout])

  const notify = (text: string) => setToast({ id: Date.now() + Math.random(), text })
  const boardLabel = (id: string) => `board ${layout.boards.findIndex(board => board.id === id) + 1}`

  /** Applies `change` to a copy of the layout and records it as one undo step. */
  function commit<T>(change: (draft: Layout) => T): T {
    const draft = structuredClone(layout)
    const result = change(draft)
    setHistory(h => ({ past: [...h.past, h.present].slice(-HISTORY_LIMIT), present: draft, future: [] }))
    return result
  }

  function undo() {
    if (!history.past.length) return
    setHistory(h => h.past.length ? { past: h.past.slice(0, -1), present: h.past.at(-1)!, future: [h.present, ...h.future] } : h)
    setSelectedId(null); setArea(null)
  }
  function redo() {
    if (!history.future.length) return
    setHistory(h => h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h)
    setSelectedId(null); setArea(null)
  }
  function replace(next: Layout) {
    setHistory({ past: [], present: next, future: [] })
    setSelectedId(null); setArea(null)
    setChosenBoardId(null)
  }

  function selectBoard(id: string) { setChosenBoardId(id); setSelectedId(null); setArea(null); setBoardHighlighted(true) }
  /** Clears the highlight on the canvas; the sidebar keeps the last board as the target for its settings. */
  function clearSelection() { setSelectedId(null); setArea(null); setBoardHighlighted(false) }
  function selectItem(id: string | null) {
    setSelectedId(id); setArea(null)
    const item = layout.items.find(entry => entry.id === id)
    if (item) { setChosenBoardId(item.boardId); setBoardHighlighted(false) }
  }

  function addAccessory(type: AccessoryId, spot: Hole | null = null, boardId = selectedBoardId) {
    const a = accessory(type)
    if (!a) return
    const preferred = layout.boards.find(board => board.id === boardId) ?? currentBoard
    let board = preferred, position = spot
    if (!position) {
      for (const candidate of [preferred, ...layout.boards.filter(entry => entry !== preferred)]) {
        position = findSpot(candidate, layout.items, type, 0)
        if (position) { board = candidate; break }
      }
    }
    if (!position) { notify(`No free holes left for a ${a.name.toLowerCase()}`); return }
    const id = nextId(), [col, row] = position
    commit(draft => { draft.items.push({ id, boardId: board.id, type, col, row, rotation: 0 }) })
    setSelectedId(id); setArea(null); setChosenBoardId(board.id); setBoardHighlighted(false)
    if (board !== preferred) notify(`${a.name} added to ${boardLabel(board.id)} — no room left on the selected board`)
  }

  function moveItem(id: string, boardId: string, col: number, row: number) {
    const item = layout.items.find(entry => entry.id === id)
    if (!item || (item.col === col && item.row === row && item.boardId === boardId)) return
    commit(draft => { Object.assign(draft.items.find(entry => entry.id === id)!, { col, row, boardId }) })
    setChosenBoardId(boardId)
  }

  function removeSelected() {
    if (!selectedItem) return
    commit(draft => { draft.items = draft.items.filter(entry => entry.id !== selectedItem.id) })
    setSelectedId(null)
  }
  function duplicateSelected() {
    if (!selectedItem) return
    const board = layout.boards.find(entry => entry.id === selectedItem.boardId)!
    const spot = findSpot(board, layout.items, selectedItem.type, selectedItem.rotation, [selectedItem.col + 2, selectedItem.row + 2])
    if (!spot) { notify('No free holes left for a copy on this board'); return }
    const id = nextId()
    commit(draft => { draft.items.push({ ...selectedItem, id, col: spot[0], row: spot[1] }) })
    setSelectedId(id)
  }
  function rotateSelected() {
    if (!selectedItem) return
    const item = selectedItem, board = layout.boards.find(entry => entry.id === item.boardId)!, rotation = item.rotation === 90 ? 0 : 90
    const spot = placementIssue(board, item.type, rotation, item.col, item.row, usedHoles(layout.items, board, item.id))
      ? findSpot(board, layout.items, item.type, rotation, [item.col, item.row], item.id)
      : [item.col, item.row]
    if (!spot) { notify('There are no free holes to rotate this piece into'); return }
    commit(draft => { Object.assign(draft.items.find(entry => entry.id === item.id)!, { rotation, col: spot[0], row: spot[1] }) })
  }
  /** Moves the selected piece `holes` steps in a direction, skipping over holes that are in use. */
  function nudgeSelected([dx, dy]: [number, number], holes: number) {
    if (!selectedItem) return
    const item = selectedItem, board = layout.boards.find(entry => entry.id === item.boardId)!, used = usedHoles(layout.items, board, item.id)
    for (let n = holes; n < 60; n++) {
      const col = item.col + dx * 2 * n, row = item.row + dy * 2 * n, issue = placementIssue(board, item.type, item.rotation, col, row, used)
      if (issue === 'edge') break
      if (!issue) { commit(draft => { Object.assign(draft.items.find(entry => entry.id === item.id)!, { col, row }) }); return }
    }
    notify('No free holes in that direction')
  }

  function clearItems() {
    if (!layout.items.length) return
    commit(draft => { draft.items = [] })
    setSelectedId(null); setArea(null)
  }

  function changeSize(size: BoardSize) {
    if (size === currentBoard.size) return
    const removed = commit(draft => {
      const board = draft.boards.find(entry => entry.id === currentBoard.id)!, fromSize = board.size
      board.size = size
      const count = refitItems(draft, board, fromSize)
      separateBoards(draft.boards, board.id)
      return count
    })
    if (removed) notify(`${plural(removed, 'piece')} didn’t fit the smaller board — Undo brings them back`)
  }
  function changeColor(color: Finish) {
    if (color !== currentBoard.color) commit(draft => { draft.boards.find(entry => entry.id === currentBoard.id)!.color = color })
  }
  function addBoard() {
    if (layout.boards.length >= MAX_BOARDS) return
    const id = `board-${nextId().slice(6)}`, spot = freeBoardSpot(layout.boards, '56x56', currentBoard)
    commit(draft => { draft.boards.push({ id, size: '56x56', color: currentBoard.color, ...spot }) })
    selectBoard(id)
  }
  function removeBoard(boardId = selectedBoardId) {
    if (layout.boards.length <= 1) return
    commit(draft => {
      draft.boards = draft.boards.filter(board => board.id !== boardId)
      draft.items = draft.items.filter(item => item.boardId !== boardId)
    })
    if (selectedItem?.boardId === boardId) setSelectedId(null)
    setArea(null)
    if (boardId === selectedBoardId) { setChosenBoardId(null); setBoardHighlighted(false) }
  }
  /** Moves a board unless it would overlap another one. Returns whether it moved. */
  function moveBoard(id: string, x: number, y: number) {
    const board = layout.boards.find(entry => entry.id === id)!
    if (overlapsAny(layout.boards, { ...board, x, y })) return false
    if (board.x === x && board.y === y) return true
    commit(draft => { Object.assign(draft.boards.find(entry => entry.id === id)!, { x, y }) })
    return true
  }

  /** Copies the selected piece, or the highlighted board with its pieces. Returns whether anything was copied. */
  function copySelection() {
    if (groupSelection) { setClipboard({ kind: 'group', ...groupContents(groupSelection) }); return true }
    if (selectedItem) { setClipboard({ kind: 'item', item: selectedItem }); return true }
    if (!boardHighlighted) return false
    setClipboard({ kind: 'board', board: currentBoard, items: layout.items.filter(item => item.boardId === currentBoard.id) })
    return true
  }
  function paste() {
    if (!clipboard) { notify('Select a piece or board and copy it first'); return }
    if (clipboard.kind === 'group') { pasteGroup(clipboard); return }
    if (clipboard.kind === 'item') {
      const { item } = clipboard, board = currentBoard
      const start: Hole = item.boardId === board.id ? [item.col + 2, item.row + 2] : [item.col, item.row]
      const spot = findSpot(board, layout.items, item.type, item.rotation, start)
      if (!spot) { notify('No free holes left on this board for the copy'); return }
      const pasted = { ...item, id: nextId(), boardId: board.id, col: spot[0], row: spot[1] }
      commit(draft => { draft.items.push(pasted) })
      setClipboard({ kind: 'item', item: pasted })
      setSelectedId(pasted.id); setArea(null); setChosenBoardId(board.id); setBoardHighlighted(false)
      return
    }
    if (layout.boards.length >= MAX_BOARDS) { notify(`You can have up to ${MAX_BOARDS} boards`); return }
    const id = `board-${nextId().slice(6)}`, spot = freeBoardSpot(layout.boards, clipboard.board.size, clipboard.board)
    commit(draft => {
      draft.boards.push({ ...clipboard.board, id, ...spot })
      draft.items.push(...clipboard.items.map(item => ({ ...item, id: nextId(), boardId: id })))
    })
    selectBoard(id)
  }

  /** Selects what a selection box covers. A box around a single piece selects just that piece. */
  function selectArea(next: AreaSelection) {
    if (!next.boardIds.length && next.itemIds.length === 1) { selectItem(next.itemIds[0]); return }
    setSelectedId(null); setBoardHighlighted(false)
    setArea(next.boardIds.length || next.itemIds.length ? next : null)
    const firstBoard = next.boardIds[0] ?? layout.items.find(item => item.id === next.itemIds[0])?.boardId
    if (firstBoard) setChosenBoardId(firstBoard)
  }
  /** Selected boards with all their pieces, plus selected pieces on other boards ("loose" pieces). */
  function groupContents(selection: AreaSelection) {
    const boardIds = new Set(selection.boardIds), itemIds = new Set(selection.itemIds)
    return {
      boards: layout.boards.filter(board => boardIds.has(board.id)),
      items: layout.items.filter(item => boardIds.has(item.boardId) || itemIds.has(item.id)),
    }
  }
  /** Moves the selected boards by (dx, dy) cm and the loose pieces by (dc, dr) holes, all or nothing. */
  function moveGroup(dx: number, dy: number, dc: number, dr: number) {
    if (!groupSelection) return false
    const boardIds = new Set(groupSelection.boardIds)
    const loose = new Set(layout.items.filter(item => groupSelection.itemIds.includes(item.id) && !boardIds.has(item.boardId)).map(item => item.id))
    const movedBoards = layout.boards.filter(board => boardIds.has(board.id)).map(board => ({ ...board, x: board.x + dx, y: board.y + dy }))
    const staying = layout.boards.filter(board => !boardIds.has(board.id))
    if (movedBoards.some(board => staying.some(other => boardRectOverlaps(board, other)))) return false
    const fixed = layout.items.filter(item => !loose.has(item.id)), movedItems: Item[] = []
    for (const item of layout.items.filter(entry => loose.has(entry.id))) {
      const board = layout.boards.find(entry => entry.id === item.boardId)!, next = { ...item, col: item.col + dc, row: item.row + dr }
      const issue = placementIssue(board, item.type, item.rotation, next.col, next.row, usedHoles([...fixed, ...movedItems], board))
      if (issue) { notify(issue === 'taken' ? 'Those holes are already in use — each hole can only hold one thing' : 'Part of the selection would come off the board'); return false }
      movedItems.push(next)
    }
    if (!dx && !dy && (!loose.size || (!dc && !dr))) return true
    commit(draft => {
      for (const board of movedBoards) Object.assign(draft.boards.find(entry => entry.id === board.id)!, { x: board.x, y: board.y })
      for (const item of movedItems) Object.assign(draft.items.find(entry => entry.id === item.id)!, { col: item.col, row: item.row })
    })
    return true
  }
  function removeGroup() {
    if (!groupSelection) return
    // At least one board always stays; if every board is selected, the first one is kept, emptied.
    const removedBoards = new Set(groupSelection.boardIds.filter(id => id !== layout.boards[0].id || groupSelection.boardIds.length < layout.boards.length))
    const itemIds = new Set(groupSelection.itemIds)
    commit(draft => {
      draft.boards = draft.boards.filter(board => !removedBoards.has(board.id))
      draft.items = draft.items.filter(item => !itemIds.has(item.id) && !removedBoards.has(item.boardId))
    })
    setArea(null)
  }
  function pasteGroup(copied: { boards: Board[]; items: Item[] }) {
    if (layout.boards.length + copied.boards.length > MAX_BOARDS) { notify(`You can have up to ${MAX_BOARDS} boards`); return }
    const [ox, oy] = groupPasteOffset(layout.boards, copied.boards)
    const boardIdMap = new Map(copied.boards.map(board => [board.id, `board-${nextId().slice(6)}`]))
    const result = commit(draft => {
      const boards = copied.boards.map(board => ({ ...board, id: boardIdMap.get(board.id)!, x: board.x + ox, y: board.y + oy }))
      draft.boards.push(...boards)
      const items: Item[] = []
      let skipped = 0
      for (const item of copied.items) {
        const newBoardId = boardIdMap.get(item.boardId)
        if (newBoardId) { items.push({ ...item, id: nextId(), boardId: newBoardId }); continue }
        const board = draft.boards.find(entry => entry.id === item.boardId) ?? draft.boards.find(entry => entry.id === currentBoard.id)!
        const start: Hole = board.id === item.boardId ? [item.col + 2, item.row + 2] : [item.col, item.row]
        const spot = findSpot(board, [...draft.items, ...items], item.type, item.rotation, start)
        if (!spot) { skipped++; continue }
        items.push({ ...item, id: nextId(), boardId: board.id, col: spot[0], row: spot[1] })
      }
      draft.items.push(...items)
      return { boards, items, skipped }
    })
    setClipboard({ kind: 'group', boards: result.boards, items: result.items })
    selectArea({ boardIds: result.boards.map(board => board.id), itemIds: result.items.map(item => item.id) })
    if (result.skipped) notify(`Pasted — ${plural(result.skipped, 'piece')} had no free holes left`)
  }
  function duplicateGroup() { if (groupSelection) pasteGroup(groupContents(groupSelection)) }

  return {
    layout, firstVisit, saveFailed, toast, notify,
    canUndo: history.past.length > 0, canRedo: history.future.length > 0, undo, redo, replace,
    selectedId, selectedItem, selectedBoardId, currentBoard, boardHighlighted, selectBoard, selectItem, clearSelection,
    groupSelection, selectedItemIds, highlightedBoardIds, selectArea, moveGroup, removeGroup, duplicateGroup,
    addAccessory, moveItem, removeSelected, duplicateSelected, rotateSelected, nudgeSelected, clearItems,
    changeSize, changeColor, addBoard, removeBoard, moveBoard, copySelection, paste,
  }
}

export type Planner = ReturnType<typeof usePlanner>
