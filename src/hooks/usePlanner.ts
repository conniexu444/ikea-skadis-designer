import { useEffect, useState } from 'react'
import { accessory, nextId, plural, type AccessoryId, type Board, type BoardSize, type Finish, type Item, type Layout } from '../lib/catalog'
import { findSpot, placementIssue, usedHoles, type Hole } from '../lib/holes'
import { MAX_BOARDS, STORAGE_KEY, freeBoardSpot, overlapsAny, readInitialLayout, refitItems, separateBoards } from '../lib/layout'

const HISTORY_LIMIT = 80

interface History { past: Layout[]; present: Layout; future: Layout[] }
export interface ToastMessage { id: number; text: string }
type Clipboard = { kind: 'item'; item: Item } | { kind: 'board'; board: Board; items: Item[] }

/** Layout state with undo/redo, persistence and every editing action. Each edit is one undo step. */
export function usePlanner() {
  const [history, setHistory] = useState<History>(() => ({ past: [], present: readInitialLayout(), future: [] }))
  const [firstVisit] = useState(() => !localStorage.getItem(STORAGE_KEY) && !location.hash.startsWith('#layout='))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [chosenBoardId, setChosenBoardId] = useState<string | null>(null)
  const [boardHighlighted, setBoardHighlighted] = useState(false)
  const [clipboard, setClipboard] = useState<Clipboard | null>(null)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [saveFailed, setSaveFailed] = useState(false)
  const layout = history.present
  const selectedBoardId = layout.boards.some(board => board.id === chosenBoardId) ? chosenBoardId! : layout.boards[0].id
  const currentBoard = layout.boards.find(board => board.id === selectedBoardId)!
  const selectedItem = layout.items.find(item => item.id === selectedId) ?? null

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
    setSelectedId(null)
  }
  function redo() {
    if (!history.future.length) return
    setHistory(h => h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h)
    setSelectedId(null)
  }
  function replace(next: Layout) {
    setHistory({ past: [], present: next, future: [] })
    setSelectedId(null)
    setChosenBoardId(null)
  }

  function selectBoard(id: string) { setChosenBoardId(id); setSelectedId(null); setBoardHighlighted(true) }
  /** Clears the highlight on the canvas; the sidebar keeps the last board as the target for its settings. */
  function clearSelection() { setSelectedId(null); setBoardHighlighted(false) }
  function selectItem(id: string | null) {
    setSelectedId(id)
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
    setSelectedId(id); setChosenBoardId(board.id); setBoardHighlighted(false)
    notify(`${a.name} added to ${boardLabel(board.id)}${board === preferred ? '' : ' — no room left on the selected board'}`)
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
    notify('Accessory removed')
  }
  function duplicateSelected() {
    if (!selectedItem) return
    const board = layout.boards.find(entry => entry.id === selectedItem.boardId)!
    const spot = findSpot(board, layout.items, selectedItem.type, selectedItem.rotation, [selectedItem.col + 2, selectedItem.row + 2])
    if (!spot) { notify('No free holes left for a copy on this board'); return }
    const id = nextId()
    commit(draft => { draft.items.push({ ...selectedItem, id, col: spot[0], row: spot[1] }) })
    setSelectedId(id)
    notify('Accessory copied')
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
    setSelectedId(null)
    notify('Accessories cleared — use Undo to bring them back')
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
    notify('Board added — drag it to arrange it')
  }
  function removeBoard() {
    if (layout.boards.length <= 1) return
    const boardId = selectedBoardId
    commit(draft => {
      draft.boards = draft.boards.filter(board => board.id !== boardId)
      draft.items = draft.items.filter(item => item.boardId !== boardId)
    })
    setSelectedId(null); setChosenBoardId(null)
    notify('Board removed — Undo can restore it')
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
    if (selectedItem) { setClipboard({ kind: 'item', item: selectedItem }); notify('Accessory copied'); return true }
    if (!boardHighlighted) return false
    setClipboard({ kind: 'board', board: currentBoard, items: layout.items.filter(item => item.boardId === currentBoard.id) })
    notify('Board copied')
    return true
  }
  function paste() {
    if (!clipboard) { notify('Select a piece or board and copy it first'); return }
    if (clipboard.kind === 'item') {
      const { item } = clipboard, board = currentBoard
      const start: Hole = item.boardId === board.id ? [item.col + 2, item.row + 2] : [item.col, item.row]
      const spot = findSpot(board, layout.items, item.type, item.rotation, start)
      if (!spot) { notify('No free holes left on this board for the copy'); return }
      const pasted = { ...item, id: nextId(), boardId: board.id, col: spot[0], row: spot[1] }
      commit(draft => { draft.items.push(pasted) })
      setClipboard({ kind: 'item', item: pasted })
      setSelectedId(pasted.id); setChosenBoardId(board.id); setBoardHighlighted(false)
      notify('Accessory pasted')
      return
    }
    if (layout.boards.length >= MAX_BOARDS) { notify(`You can have up to ${MAX_BOARDS} boards`); return }
    const id = `board-${nextId().slice(6)}`, spot = freeBoardSpot(layout.boards, clipboard.board.size, clipboard.board)
    commit(draft => {
      draft.boards.push({ ...clipboard.board, id, ...spot })
      draft.items.push(...clipboard.items.map(item => ({ ...item, id: nextId(), boardId: id })))
    })
    selectBoard(id)
    notify('Board pasted')
  }

  return {
    layout, firstVisit, saveFailed, toast, notify,
    canUndo: history.past.length > 0, canRedo: history.future.length > 0, undo, redo, replace,
    selectedId, selectedItem, selectedBoardId, currentBoard, boardHighlighted, selectBoard, selectItem, clearSelection,
    addAccessory, moveItem, removeSelected, duplicateSelected, rotateSelected, nudgeSelected, clearItems,
    changeSize, changeColor, addBoard, removeBoard, moveBoard, copySelection, paste,
  }
}

export type Planner = ReturnType<typeof usePlanner>
