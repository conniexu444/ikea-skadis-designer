import { BOARD_SIZES, WORLD_H, WORLD_W, accessory, clamp, isBoardSize, type Board, type BoardSize, type Finish, type Item, type Layout } from './catalog'
import { anchorFor, findSpot, holePoint, nearestHole, placementIssue, usedHoles } from './holes'

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
    { id: 'sample-1', boardId: 'board-1', type: 'clip', col: 4, row: 4, rotation: 0 },
    { id: 'sample-2', boardId: 'board-1', type: 'container', col: 6, row: 16, rotation: 0 },
    { id: 'sample-3', boardId: 'board-2', type: 'hook', col: 20, row: 4, rotation: 0 },
    { id: 'sample-4', boardId: 'board-2', type: 'basket', col: 4, row: 6, rotation: 0 },
    { id: 'sample-5', boardId: 'board-2', type: 'shelf', col: 6, row: 20, rotation: 0 },
  ],
}

export function boardRectOverlaps(a: Board, b: Board) {
  const aw = BOARD_SIZES[a.size][0], bw = BOARD_SIZES[b.size][0]
  return a.x < b.x + bw && a.x + aw > b.x && a.y < b.y + 56 && a.y + 56 > b.y
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
    boards = input.boards.slice(0, 2).filter((board: any) => isBoardSize(board?.size)).map((board: any, i: number) => ({
      id: `board-${i + 1}`, size: board.size as BoardSize, color: validColor(board.color),
      x: clamp(Number(board.x) || 0, 0, WORLD_W - BOARD_SIZES[board.size as BoardSize][0]),
      y: clamp(Number(board.y) || 0, 0, WORLD_H - 56),
    }))
  } else if (isBoardSize(input.size as unknown)) {
    const size = input.size as BoardSize, w = BOARD_SIZES[size][0]
    boards = [
      { id: 'board-1', size, color: validColor(input.color), x: 12, y: 13 },
      { id: 'board-2', size: '56x56', color: validColor(input.color), x: 20 + w, y: 13 },
    ]
  }
  if (!boards?.length) return null
  if (boards.length > 1 && boardRectOverlaps(boards[0], boards[1])) boards[1].x = clamp(boards[0].x + BOARD_SIZES[boards[0].size][0], 0, WORLD_W - BOARD_SIZES[boards[1].size][0])
  const items: Item[] = []
  // oxlint-disable-next-line typescript/no-explicit-any
  input.items.slice(0, 200).forEach((item: any, i: number) => {
    const a = accessory(item?.type)
    if (!a) return
    const rotation = Number(item.rotation) === 90 ? 90 : 0
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
    items.push({ id: String(item.id || `loaded-${i}`).slice(0, 80), boardId: board.id, type: a.id, col, row, rotation })
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
export const shareLink = (layout: Layout) => `${location.origin}${location.pathname}${HASH_PREFIX}${encodeLayout(layout)}`

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

/** Drops a dragged board at (x, y), snapping edge to edge when it is within 9 cm of the other board. */
export function snapBoard(boards: Board[], board: Board, x: number, y: number) {
  const [w, h] = BOARD_SIZES[board.size], other = boards.find(entry => entry.id !== board.id)
  x = clamp(x, 0, WORLD_W - w); y = clamp(y, 0, WORLD_H - h)
  const free = { x: Math.round(x * 2) / 2, y: Math.round(y * 2) / 2, snapped: false }
  if (!other) return free
  const [ow, oh] = BOARD_SIZES[other.size]
  const points = [[other.x + ow, other.y], [other.x - w, other.y], [other.x, other.y + oh], [other.x, other.y - h]]
  const valid = points.filter(([cx, cy]) => cx >= 0 && cy >= 0 && cx + w <= WORLD_W && cy + h <= WORLD_H)
  valid.sort((a, b) => Math.hypot(a[0] - x, a[1] - y) - Math.hypot(b[0] - x, b[1] - y))
  if (valid.length && Math.hypot(valid[0][0] - x, valid[0][1] - y) <= 9) return { x: valid[0][0], y: valid[0][1], snapped: true }
  return free
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
