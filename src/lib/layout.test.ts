import { describe, expect, it } from 'vitest'
import type { Layout } from './catalog'
import { moveEnd, usedHoles } from './holes'
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

  it('hangs a shelf on a top and a bottom hole at each end, 7 holes apart', () => {
    const board = DEFAULT_LAYOUT.boards[0]
    const layout = sanitizeLayout({ ...DEFAULT_LAYOUT, items: [{ id: 's', boardId: board.id, type: 'shelf', col: 2, row: 6, rotation: 90, color: 'white' }] })!
    expect(layout.items[0]).toMatchObject({ col: 2, row: 6, rotation: 0, color: 'white' })
    expect([...usedHoles(layout.items, board).keys()].sort()).toEqual(['14,6', '14,8', '2,6', '2,8'])
  })

  it('stretches an elastic cord between any two holes, and turns an old rotated cord upright', () => {
    const board = DEFAULT_LAYOUT.boards[0]
    const items = [
      { id: 'a', boardId: board.id, type: 'elastic-cord', col: 2, row: 6, rotation: 0, color: 'white' },
      { id: 'b', boardId: board.id, type: 'elastic-cord', col: 20, row: 2, rotation: 90 },
      { id: 'c', boardId: board.id, type: 'elastic-cord', col: 4, row: 20, rotation: 0, end: [6, -4] },
      { id: 'd', boardId: board.id, type: 'elastic-cord', col: 4, row: 24, rotation: 0, end: [1, 0] },
    ]
    const layout = sanitizeLayout({ ...DEFAULT_LAYOUT, items })!
    expect(layout.items.map(item => [item.rotation, item.color, item.end])).toEqual([[0, undefined, undefined], [0, undefined, [0, 12]], [0, undefined, [6, -4]], [0, undefined, undefined]])
    expect([...usedHoles(layout.items, board).keys()].sort()).toEqual(['10,16', '14,6', '16,24', '2,6', '20,14', '20,2', '4,20', '4,24'])
  })

  it('moves one end of an elastic cord to a free hole and refuses a taken one', () => {
    const board = DEFAULT_LAYOUT.boards[0]
    const cord = { id: 'a', boardId: board.id, type: 'elastic-cord' as const, col: 2, row: 6, rotation: 0 as const }
    const button = { id: 'b', boardId: board.id, type: 'button' as const, col: 8, row: 10, rotation: 0 as const }
    expect(moveEnd(board, [cord, button], cord, 1, [6, 14])).toEqual({ col: 2, row: 6, end: [4, 8], issue: null })
    expect(moveEnd(board, [cord, button], cord, 0, [20, 6])).toEqual({ col: 20, row: 6, end: [-6, 0], issue: null })
    expect(moveEnd(board, [cord, button], cord, 1, [8, 10]).issue).toBe('taken')
    expect(moveEnd(board, [cord, button], cord, 0, [14, 6]).issue).toBe('taken')
  })

  it('hangs a cup on two neighboring holes in a row and a clip on one', () => {
    const board = DEFAULT_LAYOUT.boards[0]
    const items = [
      { id: 'cup', boardId: board.id, type: 'cup', col: 2, row: 6, rotation: 0, color: 'white' },
      { id: 'clip', boardId: board.id, type: 'clip', col: 10, row: 6, rotation: 0, color: 'black' },
    ]
    const layout = sanitizeLayout({ ...DEFAULT_LAYOUT, items })!
    expect(layout.items.map(item => item.color)).toEqual(['white', 'black'])
    expect([...usedHoles(layout.items, board).keys()].sort()).toEqual(['10,6', '2,6', '4,6'])
  })

  it('hangs the MX Master holder on two neighboring holes in a row', () => {
    const board = DEFAULT_LAYOUT.boards[0]
    const layout = sanitizeLayout({ ...DEFAULT_LAYOUT, items: [{ id: 'mx', boardId: board.id, type: 'mx-holder', col: 6, row: 6, rotation: 90, color: 'gray' }] })!
    expect(layout.items.map(item => [item.rotation, item.color])).toEqual([[0, 'gray']])
    expect([...usedHoles(layout.items, board).keys()].sort()).toEqual(['6,6', '8,6'])
  })

  it('hangs a keyboard holder on three holes in one column', () => {
    const board = DEFAULT_LAYOUT.boards[0]
    const items = [
      { id: 'l', boardId: board.id, type: 'keyboard-holder', col: 6, row: 6, rotation: 90 },
      { id: 'r', boardId: board.id, type: 'keyboard-holder', col: 20, row: 6, rotation: 0, color: 'white' },
    ]
    const layout = sanitizeLayout({ ...DEFAULT_LAYOUT, items })!
    expect(layout.items.map(item => [item.rotation, item.color])).toEqual([[0, undefined], [0, 'white']])
    expect([...usedHoles(layout.items, board).keys()].sort()).toEqual(['20,10', '20,6', '20,8', '6,10', '6,6', '6,8'])
  })

  it('hangs the controller holder on two neighboring holes in a row', () => {
    const board = DEFAULT_LAYOUT.boards[0]
    const layout = sanitizeLayout({ ...DEFAULT_LAYOUT, items: [{ id: 'c', boardId: board.id, type: 'controller-holder', col: 6, row: 6, rotation: 90, color: 'white' }] })!
    expect(layout.items.map(item => [item.rotation, item.color])).toEqual([[0, 'white']])
    expect([...usedHoles(layout.items, board).keys()].sort()).toEqual(['6,6', '8,6'])
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

describe('custom accessories', () => {
  const shelf = { id: 'custom-shelf', name: 'Shelf', w: 8, h: 4, pegs: [[0, 0], [4, 0]], top: 1, left: 2, fixed: true, colors: ['white', 'gray'], detail: '' }

  it('keeps valid custom pieces and reserves every hole they clip into', () => {
    const layout = sanitizeLayout({
      ...DEFAULT_LAYOUT,
      custom: [shelf],
      items: [
        { id: 'a', boardId: DEFAULT_LAYOUT.boards[0].id, type: 'custom-shelf', col: 2, row: 2, rotation: 0 },
        { id: 'b', boardId: DEFAULT_LAYOUT.boards[0].id, type: 'button', col: 4, row: 2, rotation: 0 },
      ],
    })!
    expect(layout.custom).toHaveLength(1)
    const shelfItem = layout.items.find(item => item.id === 'a')!
    expect([shelfItem.col, shelfItem.row]).toEqual([2, 2])
    const button = layout.items.find(item => item.id === 'b')!
    expect([button.col, button.row]).not.toEqual([4, 2])
    expect(usedHoles(layout.items, layout.boards[0]).size).toBe(3)
  })

  it('drops custom pieces whose pegs are off the staggered grid, and their items', () => {
    const layout = sanitizeLayout({
      ...DEFAULT_LAYOUT,
      custom: [{ ...shelf, pegs: [[0, 0], [2, 0]] }],
      items: [{ id: 'a', boardId: DEFAULT_LAYOUT.boards[0].id, type: 'custom-shelf', col: 2, row: 2, rotation: 0 }],
    })!
    expect(layout.custom).toBeUndefined()
    expect(layout.items).toHaveLength(0)
  })
})
