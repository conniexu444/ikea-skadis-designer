import { describe, expect, it } from 'vitest'
import type { Layout } from './catalog'
import { usedHoles } from './holes'
import type { Board } from './catalog'
import { DEFAULT_LAYOUT, areaSelection, boardRectOverlaps, groupPasteOffset, holeDelta, freeBoardSpot, refitItems, sanitizeLayout, separateBoards, snapBoard } from './layout'

describe('sanitizeLayout', () => {
  it('keeps the default layout as is', () => {
    expect(sanitizeLayout(DEFAULT_LAYOUT)).toEqual(DEFAULT_LAYOUT)
  })

  it('moves a piece that would reuse a hole to a free one', () => {
    const input = { ...DEFAULT_LAYOUT, items: [...DEFAULT_LAYOUT.items, { id: 'dup', boardId: 'board-1', type: 'wall-mount', col: 1, row: 1, rotation: 0 }] }
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

  it('keeps a piece color only where that piece comes in it', () => {
    const items = [
      { id: 'a', boardId: 'board-1', type: 'hook', col: 6, row: 6, rotation: 0, color: 'white' },
      { id: 'b', boardId: 'board-1', type: 'button', col: 10, row: 6, rotation: 0, color: 'pink' },
      { id: 'c', boardId: 'board-1', type: 'wall-mount', col: 14, row: 6, rotation: 0, color: 'white' },
    ]
    const layout = sanitizeLayout({ ...DEFAULT_LAYOUT, items })!
    expect(layout.items.map(item => item.color)).toEqual(['white', undefined, undefined])
  })

  it('loads a hook upright even if the saved layout has it rotated', () => {
    const layout = sanitizeLayout({ ...DEFAULT_LAYOUT, items: [{ id: 'hook', boardId: 'board-1', type: 'hook', col: 6, row: 6, rotation: 90 }] })!
    expect(layout.items[0].rotation).toBe(0)
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

  it('stacks a board below or above the other', () => {
    const [a, b] = DEFAULT_LAYOUT.boards
    expect(snapBoard(DEFAULT_LAYOUT.boards, b, a.x + 3, a.y + 56 + 6)).toEqual({ x: a.x, y: a.y + 56, snapped: true })
    expect(snapBoard(DEFAULT_LAYOUT.boards, b, a.x + 10, a.y - 56 - 2)).toEqual({ x: a.x + 10, y: a.y - 56, snapped: true })
  })

  it('places boards anywhere on the open canvas', () => {
    const [, b] = DEFAULT_LAYOUT.boards
    expect(snapBoard(DEFAULT_LAYOUT.boards, b, -40.2, 300)).toEqual({ x: -40, y: 300, snapped: false })
  })

  it('leaves a far-away board where it was dropped', () => {
    const [a, b] = DEFAULT_LAYOUT.boards
    expect(snapBoard(DEFAULT_LAYOUT.boards, b, a.x + 56 + 20, a.y)).toMatchObject({ x: a.x + 76, snapped: false })
  })
})

describe('more than two boards', () => {
  const board = (id: string, x: number, y: number): Board => ({ id, size: '56x56', color: 'white', x, y })
  const noOverlaps = (boards: Board[]) => boards.every((a, i) => boards.slice(i + 1).every(b => !boardRectOverlaps(a, b)))

  it('keeps every board from a saved layout', () => {
    const boards = [board('a', 0, 0), board('b', 60, 0), board('c', 0, 60)]
    expect(sanitizeLayout({ name: 'x', boards, items: [] })!.boards).toHaveLength(3)
  })

  it('pushes overlapping boards apart', () => {
    const boards = [board('a', 0, 0), board('b', 10, 0), board('c', 20, 5)]
    separateBoards(boards)
    expect(boards[0].x).toBe(0)
    expect(noOverlaps(boards)).toBe(true)
  })

  it('finds a free spot next to a board, skipping taken sides', () => {
    const a = board('a', 0, 0)
    expect(freeBoardSpot([a], '56x56', a)).toEqual({ x: 62, y: 0 })
    const b = board('b', 62, 0)
    expect(freeBoardSpot([a, b], '56x56', a)).toEqual({ x: 0, y: 62 })
  })

  it('snaps to whichever board is close and never onto another', () => {
    const boards = [board('a', 0, 0), board('b', 56, 0), board('c', 200, 200)]
    expect(snapBoard(boards, boards[2], 3, 59)).toEqual({ x: 0, y: 56, snapped: true })
    expect(snapBoard(boards, boards[2], 60, 58)).toEqual({ x: 56, y: 56, snapped: true })
  })
})

describe('areaSelection', () => {
  const layout: Layout = {
    name: 'test',
    boards: [{ id: 'a', size: '36x56', color: 'white', x: 0, y: 0 }, { id: 'b', size: '56x56', color: 'white', x: 40, y: 0 }],
    items: [{ id: 'p', boardId: 'b', type: 'wall-mount', col: 2, row: 2, rotation: 0 }],
  }

  it('selects a board only when it is fully inside the box', () => {
    expect(areaSelection(layout, -1, -1, 37, 57).boardIds).toEqual(['a'])
    expect(areaSelection(layout, -1, -1, 35, 57).boardIds).toEqual([])
  })

  it('selects an accessory the box only touches', () => {
    const selection = areaSelection(layout, 0, 0, 47, 7)
    expect(selection.itemIds).toEqual(['p'])
    expect(selection.boardIds).toEqual([])
  })
})

describe('holeDelta', () => {
  it('rounds a drag to a step that stays on the staggered grid', () => {
    for (const [dx, dy] of [[0, 0], [3.1, 0.2], [-5, 4.4], [1.9, 2.1], [10, -7]]) {
      const [dc, dr] = holeDelta(dx, dy)
      expect(Math.abs(dc + dr) % 2).toBe(0)
      expect(Math.hypot(dc * 2 - dx, dr * 2 - dy)).toBeLessThanOrEqual(2.9)
    }
  })
})

describe('groupPasteOffset', () => {
  it('places copied boards where they do not overlap anything', () => {
    const boards: Board[] = [{ id: 'a', size: '36x56', color: 'white', x: 0, y: 0 }, { id: 'b', size: '36x56', color: 'white', x: 37, y: 0 }]
    const [ox, oy] = groupPasteOffset(boards, boards)
    expect(boards.some(copy => boards.some(other => boardRectOverlaps({ ...copy, id: 'x', x: copy.x + ox, y: copy.y + oy }, other)))).toBe(false)
  })
})
