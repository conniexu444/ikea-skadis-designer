export type BoardSize = '36x56' | '56x56' | '76x56'
export type Finish = 'white' | 'black' | 'wood'
export type Rotation = 0 | 90
export type AccessoryGroup = 'mounting' | 'small' | 'storage' | 'display'
export type AccessoryId =
  | 'wall-mount' | 'hook' | 'double-hook' | 'container' | 'shelf' | 'basket' | 'clip' | 'letter-holder' | 'elastic'

export interface Accessory {
  id: AccessoryId
  name: string
  group: AccessoryGroup
  /** Size in cm. */
  w: number
  h: number
  /** Peg offsets in cm from the first peg. */
  pegs: [number, number][]
  /** Distance in cm from the top of the piece to its highest peg. */
  top?: number
  detail: string
}

export interface Board { id: string; size: BoardSize; color: Finish; x: number; y: number }
export interface Item { id: string; boardId: string; type: AccessoryId; col: number; row: number; rotation: Rotation }
export interface Layout { name: string; boards: Board[]; items: Item[] }

export const ACCESSORIES: Accessory[] = [
  { id: 'wall-mount', name: 'Wall mount', group: 'mounting', w: 3, h: 3, pegs: [[0, 0]], detail: 'Screws the board to the wall' },
  { id: 'hook', name: 'Hook', group: 'small', w: 7, h: 8, pegs: [[0, 0]], detail: 'For headphones, keys & more' },
  { id: 'double-hook', name: 'Double hook', group: 'small', w: 13, h: 8, pegs: [[0, 0], [4, 0]], detail: 'A little extra hanging room' },
  { id: 'container', name: 'Container', group: 'storage', w: 14, h: 16, pegs: [[0, 0], [8, 0]], detail: 'For pens and small things' },
  { id: 'shelf', name: 'Shelf', group: 'display', w: 28, h: 8, pegs: [[0, 0], [24, 0]], detail: 'Keep favorites on show' },
  { id: 'basket', name: 'Mesh basket', group: 'storage', w: 24, h: 16, pegs: [[0, 0], [16, 0]], detail: 'An open home for essentials' },
  { id: 'clip', name: 'Clip', group: 'small', w: 7, h: 9, pegs: [[0, 0]], detail: 'Pin a note or photo' },
  { id: 'letter-holder', name: 'Letter holder', group: 'storage', w: 20, h: 17, pegs: [[0, 0], [12, 0]], detail: 'Tidy papers and mail' },
  { id: 'elastic', name: 'Elastic cord', group: 'display', w: 20, h: 12, pegs: [[0, 0], [16, 0], [0, 8], [16, 8]], top: 2, detail: 'Tuck things into place' },
]

export const FILTERS: { id: AccessoryGroup | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'mounting', label: 'Mounts' },
  { id: 'storage', label: 'Storage' },
  { id: 'display', label: 'Display' },
  { id: 'small', label: 'Small' },
]

export const BOARD_SIZES: Record<BoardSize, [number, number]> = { '36x56': [36, 56], '56x56': [56, 56], '76x56': [76, 56] }
export const FINISHES: Finish[] = ['white', 'black', 'wood']
/** Boards sit on an open canvas; this only bounds coordinates read from untrusted saved/shared data, in cm. */
export const CANVAS_LIMIT = 5000

export function accessory(type: string): Accessory | undefined {
  return ACCESSORIES.find(item => item.id === type)
}
export function isBoardSize(size: unknown): size is BoardSize {
  return typeof size === 'string' && size in BOARD_SIZES
}
export const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), Math.max(min, max))
export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
export const nextId = () => `piece-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
