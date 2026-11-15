import { BOARD_SIZES, accessory, clamp, type Board, type BoardSize, type Item, type Rotation } from './catalog'

export const HOLE_PITCH = 2
export const HOLE_MARGIN = 2

// SKÅDIS holes sit on a staggered grid: 2 cm apart diagonally, so holes in the same row or column are 4 cm apart.
// The 36×56 board's rows alternate 8 and 9 holes, starting and ending with 8 (parity 1 shifts the first row in).
const HOLE_LAYOUTS: Partial<Record<BoardSize, Partial<HoleGrid>>> = { '36x56': { parity: 1 } }

export type Hole = [col: number, row: number]
export type PlacementIssue = 'edge' | 'taken'
interface HoleGrid { cols: number; rows: number; x0: number; y0: number; parity: number }

export function holeGrid(size: BoardSize): HoleGrid {
  const [bw, bh] = BOARD_SIZES[size], layout = HOLE_LAYOUTS[size] ?? {}
  return {
    cols: layout.cols ?? Math.round((bw - 2 * HOLE_MARGIN) / HOLE_PITCH) + 1,
    rows: layout.rows ?? Math.round((bh - 2 * HOLE_MARGIN) / HOLE_PITCH) + 1,
    x0: layout.x0 ?? HOLE_MARGIN,
    y0: layout.y0 ?? HOLE_MARGIN,
    parity: layout.parity ?? 0,
  }
}

export function holeExists(size: BoardSize, col: number, row: number) {
  const { cols, rows, parity } = holeGrid(size)
  return Number.isInteger(col) && Number.isInteger(row) && col >= 0 && row >= 0 && col < cols && row < rows && (col + row) % 2 === parity
}

export function holePoint(size: BoardSize, col: number, row: number): [number, number] {
  const { x0, y0 } = holeGrid(size)
  return [x0 + col * HOLE_PITCH, y0 + row * HOLE_PITCH]
}

export const holeKey = (col: number, row: number) => `${col},${row}`

const holeCache = new Map<BoardSize, Hole[]>()
export function allHoles(size: BoardSize): Hole[] {
  let holes = holeCache.get(size)
  if (!holes) {
    const { cols, rows, parity } = holeGrid(size)
    holes = []
    for (let row = 0; row < rows; row++) for (let col = (row + parity) % 2; col < cols; col += 2) holes.push([col, row])
    holeCache.set(size, holes)
  }
  return holes
}

/** Peg offsets and bounding rect, in cm, relative to the piece's anchor peg. */
export function geometry(type: string, rotation: Rotation = 0) {
  const a = accessory(type)!
  const xs = a.pegs.map(peg => peg[0]), ys = a.pegs.map(peg => peg[1])
  const ox = (Math.min(...xs) + Math.max(...xs)) / 2 - a.w / 2, oy = Math.min(...ys) - (a.top ?? 1.5)
  const pegs = a.pegs.map(([x, y]) => (rotation === 90 ? [-y, x] : [x, y]) as [number, number])
  const rect: [number, number, number, number] = rotation === 90 ? [-(oy + a.h), ox, a.h, a.w] : [ox, oy, a.w, a.h]
  return { pegs, rect }
}

export function placement(size: BoardSize, type: string, rotation: Rotation, col: number, row: number) {
  const { pegs, rect } = geometry(type, rotation), [ax, ay] = holePoint(size, col, row)
  return {
    holes: pegs.map(([x, y]) => [col + x / HOLE_PITCH, row + y / HOLE_PITCH] as Hole),
    rect: [ax + rect[0], ay + rect[1], rect[2], rect[3]] as [number, number, number, number],
  }
}

export const itemPlacement = (item: Item, size: BoardSize) => placement(size, item.type, item.rotation, item.col, item.row)

export function usedHoles(items: Item[], board: Board, ignoreId: string | null = null) {
  const used = new Set<string>()
  for (const item of items) {
    if (item.boardId === board.id && item.id !== ignoreId) itemPlacement(item, board.size).holes.forEach(([col, row]) => used.add(holeKey(col, row)))
  }
  return used
}

/** A piece fits when every peg is on a free hole; its body may hang past the board edge. */
export function placementIssue(board: Board, type: string, rotation: Rotation, col: number, row: number, used: Set<string>): PlacementIssue | null {
  const { holes } = placement(board.size, type, rotation, col, row)
  if (!holes.every(([c, r]) => holeExists(board.size, c, r))) return 'edge'
  return holes.some(([c, r]) => used.has(holeKey(c, r))) ? 'taken' : null
}

function onBoard(board: Board, type: string, rotation: Rotation, col: number, row: number) {
  const [x, y, w, h] = placement(board.size, type, rotation, col, row).rect, [bw, bh] = BOARD_SIZES[board.size], eps = 1e-6
  return x >= -eps && y >= -eps && x + w <= bw + eps && y + h <= bh + eps
}

export function nearestHole(size: BoardSize, x: number, y: number): Hole {
  const { cols, rows, x0, y0 } = holeGrid(size), fc = (x - x0) / HOLE_PITCH, fr = (y - y0) / HOLE_PITCH
  let best: Hole | null = null, bestDistance = Infinity
  for (let col = Math.floor(fc) - 1; col <= Math.ceil(fc) + 1; col++) {
    for (let row = Math.floor(fr) - 1; row <= Math.ceil(fr) + 1; row++) {
      const c = clamp(col, 0, cols - 1), r = clamp(row, 0, rows - 1)
      if (!holeExists(size, c, r)) continue
      const distance = Math.hypot(c - fc, r - fr)
      if (distance < bestDistance) { best = [c, r]; bestDistance = distance }
    }
  }
  return best ?? [0, 0]
}

/** The anchor hole closest to a piece whose top-left corner is at (x, y) cm, among those where every peg lands on a hole. */
export function anchorFor(size: BoardSize, type: string, rotation: Rotation, x: number, y: number): Hole {
  const { rect } = geometry(type, rotation), [tx, ty] = [x - rect[0], y - rect[1]]
  let best: Hole | null = null, bestDistance = Infinity
  for (const [col, row] of allHoles(size)) {
    const [hx, hy] = holePoint(size, col, row), distance = Math.hypot(hx - tx, hy - ty)
    if (distance < bestDistance && placement(size, type, rotation, col, row).holes.every(([c, r]) => holeExists(size, c, r))) { best = [col, row]; bestDistance = distance }
  }
  return best ?? nearestHole(size, tx, ty)
}

export function findSpot(board: Board, items: Item[], type: string, rotation: Rotation, near: Hole | null = null, ignoreId: string | null = null): Hole | null {
  const used = usedHoles(items, board, ignoreId)
  let holes = allHoles(board.size)
  if (near) holes = [...holes].sort((a, b) => Math.hypot(a[0] - near[0], (a[1] - near[1]) * 1.01) - Math.hypot(b[0] - near[0], (b[1] - near[1]) * 1.01))
  const free = holes.filter(([col, row]) => !placementIssue(board, type, rotation, col, row, used))
  // Automatic placement keeps pieces on the board when it can; only dragging deliberately hangs them off.
  return free.find(([col, row]) => onBoard(board, type, rotation, col, row)) ?? free[0] ?? null
}

export function holeStats(items: Item[], board: Board) {
  return { used: usedHoles(items, board).size, total: allHoles(board.size).length }
}
