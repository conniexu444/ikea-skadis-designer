import { BOARD_SIZES, CANVAS_LIMIT, accessory, clamp, isBoardSize, type Board, type BoardSize, type Finish, type Item, type Layout, type PieceColor } from './catalog'
import { HOLE_PITCH, anchorFor, findSpot, holePoint, itemPlacement, nearestHole, placementIssue, usedHoles } from './holes'

export const STORAGE_KEY = 'skadis-studio-v3'
const LEGACY_KEYS = ['skadis-studio-v2', 'skadis-studio-v1']
const HASH_PREFIX = '#layout='

const cornerMounts = (prefix: string, boardId: string): Item[] =>
  ([[1, 1], [25, 1], [1, 25], [25, 25]] as const).map(([col, row], i) => ({ id: `${prefix}-mount-${i + 1}`, boardId, type: 'wall-mount', col, row, rotation: 0 }))

export const DEFAULT_LAYOUT: Layout = {
  name: 'My perfect setup',
  boards: [
    { id: 'board-1', size: '56x56', color: 'white', x: 22, y: 15 },
    { id: 'board-2', size: '56x56', color: 'white', x: 85, y: 15 },
  ],
  items: [
    ...cornerMounts('sample-1', 'board-1'),
    ...cornerMounts('sample-2', 'board-2'),
  ],
}

export const MAX_BOARDS = 20
const BOARD_GAP = 6

export function boardRectOverlaps(a: Board, b: Board) {
  const aw = BOARD_SIZES[a.size][0], bw = BOARD_SIZES[b.size][0]
  return a.x < b.x + bw && a.x + aw > b.x && a.y < b.y + 56 && a.y + 56 > b.y
}

/** Whether `board` would overlap any other board in `boards`. */
export const overlapsAny = (boards: Board[], board: Board) => boards.some(other => other.id !== board.id && boardRectOverlaps(board, other))

/** Pushes overlapping boards to the right until none overlap. The `keepId` board, then the leftmost, stay put. */
export function separateBoards(boards: Board[], keepId?: string) {
  const placed: Board[] = []
  for (const board of [...boards].sort((a, b) => (a.id === keepId ? -1 : b.id === keepId ? 1 : a.x - b.x))) {
    let hit: Board | undefined
    while ((hit = placed.find(other => boardRectOverlaps(board, other)))) board.x = hit.x + BOARD_SIZES[hit.size][0]
    placed.push(board)
  }
}

/** A free spot for a new board: beside, below, left of or above `near`, else past the rightmost board. */
export function freeBoardSpot(boards: Board[], size: BoardSize, near: Board) {
  const [w] = BOARD_SIZES[size], [nw] = BOARD_SIZES[near.size]
  const spots = [[near.x + nw + BOARD_GAP, near.y], [near.x, near.y + 56 + BOARD_GAP], [near.x - w - BOARD_GAP, near.y], [near.x, near.y - 56 - BOARD_GAP]]
  const spot = spots.find(([x, y]) => !overlapsAny(boards, { ...near, id: '', size, x, y }))
  if (spot) return { x: spot[0], y: spot[1] }
  return { x: Math.max(...boards.map(board => board.x + BOARD_SIZES[board.size][0])) + BOARD_GAP, y: near.y }
}

/**
 * Validates untrusted layout data (saved state, share links, older versions).
 * Pieces that would reuse a hole are moved to the nearest free spot, or dropped if none is left.
 */
// oxlint-disable-next-line typescript/no-explicit-any
export function sanitizeLayout(input: any): Layout | null {
  if (!input || !Array.isArray(input.items)) return null
  const validColor = (color: unknown): Finish => (color === 'black' || color === 'wood' ? color : 'white')
  let boards: Board[] | undefined
  if (Array.isArray(input.boards) && input.boards.length) {
    // oxlint-disable-next-line typescript/no-explicit-any
    boards = input.boards.slice(0, MAX_BOARDS).filter((board: any) => isBoardSize(board?.size)).map((board: any, i: number) => ({
      id: `board-${i + 1}`, size: board.size as BoardSize, color: validColor(board.color),
      x: clamp(Number(board.x) || 0, -CANVAS_LIMIT, CANVAS_LIMIT),
      y: clamp(Number(board.y) || 0, -CANVAS_LIMIT, CANVAS_LIMIT),
    }))
  } else if (isBoardSize(input.size as unknown)) {
    const size = input.size as BoardSize, w = BOARD_SIZES[size][0]
    boards = [
      { id: 'board-1', size, color: validColor(input.color), x: 12, y: 13 },
      { id: 'board-2', size: '56x56', color: validColor(input.color), x: 20 + w, y: 13 },
    ]
  }
  if (!boards?.length) return null
  separateBoards(boards)
  const items: Item[] = []
  // oxlint-disable-next-line typescript/no-explicit-any
  input.items.slice(0, 200).forEach((item: any, i: number) => {
    const a = accessory(item?.type)
    if (!a) return
    const rotation = !a.fixed && Number(item.rotation) === 90 ? 90 : 0
    // oxlint-disable-next-line typescript/no-explicit-any
    const boardIndex = Array.isArray(input.boards) ? input.boards.findIndex((board: any) => board?.id === item.boardId) : 0
    const board = boards[Math.max(0, Math.min(boardIndex, boards.length - 1))]
    let col = Number(item.col), row = Number(item.row)
    if (!Number.isInteger(col) || !Number.isInteger(row)) [col, row] = anchorFor(board.size, a.id, rotation, Number(item.x) || 0, Number(item.y) || 0)
    if (placementIssue(board, a.id, rotation, col, row, usedHoles(items, board))) {
      const spot = findSpot(board, items, a.id, rotation, [col, row])
      if (!spot) return
      ;[col, row] = spot
    }
    items.push({ id: String(item.id || `loaded-${i}`).slice(0, 80), boardId: board.id, type: a.id, col, row, rotation, ...(a.colors?.includes(item.color) ? { color: item.color as PieceColor } : {}) })
  })
  return { name: String(input.name || 'My perfect setup').slice(0, 60), boards, items }
}

export function decodeLayout(value: string): Layout | null {
  try { return sanitizeLayout(JSON.parse(decodeURIComponent(value))) }
  catch { return null }
}
export const encodeLayout = (layout: Layout) => encodeURIComponent(JSON.stringify(layout))

export function sharedLayout(hash: string) {
  return hash.startsWith(HASH_PREFIX) ? decodeLayout(hash.slice(HASH_PREFIX.length)) : null
}

export function readInitialLayout(): Layout {
  const shared = sharedLayout(location.hash)
  if (shared) return shared
  for (const key of [STORAGE_KEY, ...LEGACY_KEYS]) {
    try {
      const loaded = sanitizeLayout(JSON.parse(localStorage.getItem(key) ?? 'null'))
      if (loaded) return loaded
    } catch { /* try the next saved version */ }
  }
  return structuredClone(DEFAULT_LAYOUT)
}

const SNAP_DISTANCE = 9, ALIGN_DISTANCE = 4

/**
 * Where a dragged board lands on the open canvas. Within SNAP_DISTANCE cm of another board it snaps edge to edge
 * (beside, above or below), sliding freely along that edge but lining up with any board's edges when close.
 */
export function snapBoard(boards: Board[], board: Board, x: number, y: number) {
  const [w, h] = BOARD_SIZES[board.size]
  const half = (n: number) => Math.round(n * 2) / 2
  const free = { x: half(x), y: half(y), snapped: false }
  const align = (value: number, edges: number[]) => edges.find(edge => Math.abs(edge - value) <= ALIGN_DISTANCE) ?? half(value)
  const others = boards.filter(other => other.id !== board.id)
  const xEdges = others.flatMap(other => [other.x, other.x + BOARD_SIZES[other.size][0] - w])
  const yEdges = others.flatMap(other => [other.y, other.y + BOARD_SIZES[other.size][1] - h])
  const candidates: { x: number; y: number }[] = []
  for (const other of others) {
    const [ow, oh] = BOARD_SIZES[other.size]
    if (y < other.y + oh && y + h > other.y) {
      for (const cx of [other.x + ow, other.x - w]) candidates.push({ x: cx, y: align(y, yEdges) })
    }
    if (x < other.x + ow && x + w > other.x) {
      for (const cy of [other.y + oh, other.y - h]) candidates.push({ x: align(x, xEdges), y: cy })
    }
  }
  const best = candidates
    .filter(c => !overlapsAny(boards, { ...board, ...c }))
    .map(c => ({ ...c, distance: Math.hypot(c.x - x, c.y - y) }))
    .sort((a, b) => a.distance - b.distance)[0]
  return best && best.distance <= SNAP_DISTANCE ? { x: best.x, y: best.y, snapped: true } : free
}

/**
 * Re-places a board's pieces after its size changes. Pieces keep their distance from the nearest
 * board edge, so corner mounts stay in the corners. Returns how many pieces no longer fit.
 */
export function refitItems(layout: Layout, board: Board, fromSize: BoardSize = board.size) {
  const kept = layout.items.filter(item => item.boardId !== board.id), [ow, oh] = BOARD_SIZES[fromSize], [nw, nh] = BOARD_SIZES[board.size]
  let removed = 0
  layout.items.filter(item => item.boardId === board.id).forEach(item => {
    let { col, row } = item
    if (fromSize !== board.size) {
      const [x, y] = holePoint(fromSize, col, row)
      ;[col, row] = nearestHole(board.size, x > ow / 2 ? x + nw - ow + 0.02 : x - 0.02, y > oh / 2 ? y + nh - oh + 0.01 : y - 0.01)
    }
    const spot = placementIssue(board, item.type, item.rotation, col, row, usedHoles(kept, board)) ? findSpot(board, kept, item.type, item.rotation, [col, row]) : [col, row]
    if (spot) kept.push({ ...item, col: spot[0], row: spot[1] })
    else removed++
  })
  layout.items = kept
  return removed
}

export interface AreaSelection { boardIds: string[]; itemIds: string[] }

/** What a selection box covers, in cm: pieces it touches, and boards that sit fully inside it. */
export function areaSelection(layout: Layout, left: number, top: number, right: number, bottom: number): AreaSelection {
  const boards = new Map(layout.boards.map(board => [board.id, board]))
  return {
    boardIds: layout.boards.filter(board => {
      const [w, h] = BOARD_SIZES[board.size]
      return board.x >= left && board.y >= top && board.x + w <= right && board.y + h <= bottom
    }).map(board => board.id),
    itemIds: layout.items.filter(item => {
      const board = boards.get(item.boardId)
      if (!board) return false
      const [ix, iy, w, h] = itemPlacement(item, board.size).rect, x = board.x + ix, y = board.y + iy
      return x < right && x + w > left && y < bottom && y + h > top
    }).map(item => item.id),
  }
}

/** The hole step closest to a drag of (dx, dy) cm. Steps keep col + row even, so pieces stay on the staggered grid. */
export function holeDelta(dx: number, dy: number): [number, number] {
  const fc = dx / HOLE_PITCH, fr = dy / HOLE_PITCH
  let dc = Math.round(fc), dr = Math.round(fr)
  if ((dc + dr) % 2) {
    if (Math.abs(fc - dc) > Math.abs(fr - dr)) dc += fc > dc ? 1 : -1
    else dr += fr > dr ? 1 : -1
  }
  return [dc + 0, dr + 0]
}

/** How far to shift a group of copied boards so none of them overlaps an existing board. */
export function groupPasteOffset(boards: Board[], copies: Board[]): [number, number] {
  if (!copies.length) return [0, 0]
  const left = Math.min(...copies.map(board => board.x)), right = Math.max(...copies.map(board => board.x + BOARD_SIZES[board.size][0]))
  const top = Math.min(...copies.map(board => board.y)), bottom = Math.max(...copies.map(board => board.y + BOARD_SIZES[board.size][1]))
  const w = right - left + BOARD_GAP, h = bottom - top + BOARD_GAP
  const offset = ([[w, 0], [0, h], [-w, 0], [0, -h]] as [number, number][])
    .find(([ox, oy]) => copies.every(board => !overlapsAny(boards, { ...board, id: '', x: board.x + ox, y: board.y + oy })))
  return offset ?? [Math.max(...boards.map(board => board.x + BOARD_SIZES[board.size][0])) + BOARD_GAP - left, 0]
}
