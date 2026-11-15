import { describe, expect, it } from 'vitest'
import type { Board, Item } from './catalog'
import { allHoles, findSpot, holeExists, placement, placementIssue, usedHoles } from './holes'

const rowCounts = (size: Board['size']) => {
  const rows = new Map<number, number>()
  allHoles(size).forEach(([, row]) => rows.set(row, (rows.get(row) ?? 0) + 1))
  return [...rows.values()]
}

describe('hole grid', () => {
  it('gives the 36×56 board 27 rows alternating 8 and 9 holes, with 8 at the top and bottom', () => {
    const rows = rowCounts('36x56')
    expect(rows).toHaveLength(27)
    expect(rows).toEqual(rows.map((_, i) => (i % 2 === 0 ? 8 : 9)))
    expect(allHoles('36x56')).toHaveLength(229)
  })

  it('gives the 56×56 board 365 holes', () => {
    expect(allHoles('56x56')).toHaveLength(365)
  })

  it('only has holes on the staggered positions', () => {
    expect(holeExists('56x56', 0, 0)).toBe(true)
    expect(holeExists('56x56', 1, 0)).toBe(false)
    expect(holeExists('36x56', 0, 0)).toBe(false)
    expect(holeExists('36x56', 1, 0)).toBe(true)
  })
})

describe('hole occupancy', () => {
  const board: Board = { id: 'b', size: '56x56', color: 'white', x: 0, y: 0 }
  const mount: Item = { id: 'm', boardId: 'b', type: 'wall-mount', col: 4, row: 4, rotation: 0 }

  it('refuses a piece on a hole a wall mount already uses', () => {
    const used = usedHoles([mount], board)
    expect(placementIssue(board, 'hook', 0, 4, 4, used)).toBe('taken')
    expect(placementIssue(board, 'hook', 0, 6, 4, used)).toBeNull()
  })

  it('ignores the piece being moved', () => {
    expect(placementIssue(board, 'wall-mount', 0, 4, 4, usedHoles([mount], board, 'm'))).toBeNull()
  })

  it('lets pieces hang off the board but refuses pegs that miss a hole', () => {
    const hanging = allHoles(board.size).filter(([col, row]) => {
      const [x, y, w, h] = placement(board.size, 'shelf', 0, col, row).rect
      return !placementIssue(board, 'shelf', 0, col, row, new Set()) && (x < 0 || y < 0 || x + w > 56 || y + h > 56)
    })
    expect(hanging.length).toBeGreaterThan(0)
    expect(placementIssue(board, 'hook', 0, 1, 0, new Set())).toBe('edge')
  })

  it('prefers spots fully on the board when placing automatically', () => {
    const [x, y, w, h] = placement(board.size, 'shelf', 0, ...findSpot(board, [], 'shelf', 0, [20, 4])!).rect
    expect(x >= 0 && y >= 0 && x + w <= 56 && y + h <= 56).toBe(true)
  })

  it('finds a free spot that never reuses a hole', () => {
    const items: Item[] = []
    for (let i = 0; i < 400; i++) {
      const spot = findSpot(board, items, 'wall-mount', 0)
      if (!spot) break
      items.push({ ...mount, id: `m${i}`, col: spot[0], row: spot[1] })
    }
    expect(items).toHaveLength(usedHoles(items, board).size)
    expect(findSpot(board, items, 'wall-mount', 0)).toBeNull()
  })
})
