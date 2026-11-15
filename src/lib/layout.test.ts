import { describe, expect, it } from 'vitest'
import type { Layout } from './catalog'
import { usedHoles } from './holes'
import { DEFAULT_LAYOUT, refitItems, sanitizeLayout, snapBoard } from './layout'

describe('sanitizeLayout', () => {
  it('keeps the default layout as is', () => {
    expect(sanitizeLayout(DEFAULT_LAYOUT)).toEqual(DEFAULT_LAYOUT)
  })

  it('moves a piece that would reuse a hole to a free one', () => {
    const input = { ...DEFAULT_LAYOUT, items: [...DEFAULT_LAYOUT.items, { id: 'dup', boardId: 'board-1', type: 'hook', col: 1, row: 1, rotation: 0 }] }
    const layout = sanitizeLayout(input)!
    const board = layout.boards[0]
    const onBoard = layout.items.filter(item => item.boardId === board.id)
    const dup = layout.items.find(item => item.id === 'dup')!
    expect([dup.col, dup.row]).not.toEqual([1, 1])
    expect(onBoard.length).toBeLessThanOrEqual(usedHoles(layout.items, board).size)
  })

  it('rejects garbage and drops unknown pieces', () => {
    expect(sanitizeLayout(null)).toBeNull()
    expect(sanitizeLayout({ items: [], boards: [{ size: '10x10' }] })).toBeNull()
    const layout = sanitizeLayout({ ...DEFAULT_LAYOUT, items: [{ type: 'rocket', col: 2, row: 2 }] })!
    expect(layout.items).toEqual([])
  })
})

describe('refitItems', () => {
  it('keeps corner mounts in the corners when a board shrinks to 36×56', () => {
    const layout: Layout = structuredClone(DEFAULT_LAYOUT)
    const board = layout.boards[0]
    board.size = '36x56'
    refitItems(layout, board, '56x56')
    const mounts = layout.items.filter(item => item.boardId === board.id && item.type === 'wall-mount').map(item => [item.col, item.row])
    expect(mounts.every(([col, row]) => (col <= 2 || col >= 14) && (row <= 2 || row >= 24))).toBe(true)
    expect(mounts).toHaveLength(4)
    expect(new Set(mounts.map(String)).size).toBe(4)
  })
})

describe('snapBoard', () => {
  it('snaps a dragged board to the other board edge when close', () => {
    const [a, b] = DEFAULT_LAYOUT.boards
    expect(snapBoard(DEFAULT_LAYOUT.boards, b, a.x + 56 + 4, a.y + 2)).toEqual({ x: a.x + 56, y: a.y, snapped: true })
  })

  it('lets a snapped board slide along the edge', () => {
    const [a, b] = DEFAULT_LAYOUT.boards
    expect(snapBoard(DEFAULT_LAYOUT.boards, b, a.x + 56 + 3, a.y + 10)).toEqual({ x: a.x + 56, y: a.y + 10, snapped: true })
  })

  it('snaps to the left edge too', () => {
    const [a, b] = DEFAULT_LAYOUT.boards
    expect(snapBoard(DEFAULT_LAYOUT.boards, a, b.x - 56 - 5, b.y)).toEqual({ x: b.x - 56, y: b.y, snapped: true })
  })

  it('leaves a far-away board where it was dropped', () => {
    const [a, b] = DEFAULT_LAYOUT.boards
    expect(snapBoard(DEFAULT_LAYOUT.boards, b, a.x + 56 + 20, a.y)).toMatchObject({ x: a.x + 76, snapped: false })
  })
})
