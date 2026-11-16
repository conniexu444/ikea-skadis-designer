export type BoardSize = '36x56' | '56x56' | '76x56'
export type Finish = 'white' | 'black' | 'wood'
export type Rotation = 0 | 90
export type AccessoryId = 'wall-mount' | 'hook'

export interface Accessory {
  id: AccessoryId
  name: string
  /** Size in cm. */
  w: number
  h: number
  /** Peg offsets in cm from the first peg. */
  pegs: [number, number][]
  /** Distance in cm from the top of the piece to its highest peg. */
  top?: number
  /** Hangs one way only, so it can't be rotated. */
  fixed?: boolean
  detail: string
}

export interface Board { id: string; size: BoardSize; color: Finish; x: number; y: number }
export interface Item { id: string; boardId: string; type: AccessoryId; col: number; row: number; rotation: Rotation }
export interface Layout { name: string; boards: Board[]; items: Item[] }

export const ACCESSORIES: Accessory[] = [
  { id: 'wall-mount', name: 'Wall mount', w: 3, h: 3, pegs: [[0, 0]], detail: 'Screws the board to the wall' },
  { id: 'hook', name: 'Hook', w: 6, h: 14, pegs: [[0, 0], [0, 4]], fixed: true, detail: 'Clips into two holes, one above the other' },
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
