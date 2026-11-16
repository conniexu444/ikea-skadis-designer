export type BoardSize = '36x56' | '56x56' | '76x56'
export type Finish = 'white' | 'black' | 'wood'
export type Rotation = 0 | 90
export type BuiltinId = 'wall-mount' | 'hook' | 'long-hook' | 'button' | 'shelf' | 'cup' | 'clip' | 'elastic-cord'
export type AccessoryId = BuiltinId | `custom-${string}`
export type PieceColor = 'white' | 'gray' | 'black'

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
  /** Distance in cm from the left of the piece to its leftmost peg; pegs are centered when unset. */
  left?: number
  /** Hangs one way only, so it can't be rotated. */
  fixed?: boolean
  /** Colors it comes in; the first is the default. */
  colors?: PieceColor[]
  detail: string
}

export interface Board { id: string; size: BoardSize; color: Finish; x: number; y: number }
export interface Item { id: string; boardId: string; type: AccessoryId; col: number; row: number; rotation: Rotation; color?: PieceColor }
export interface Layout { name: string; boards: Board[]; items: Item[]; custom?: Accessory[] }

export const ACCESSORIES: Accessory[] = [
  { id: 'wall-mount', name: 'Wall mount', w: 3, h: 3, pegs: [[0, 0]], detail: 'Screws the board to the wall' },
  { id: 'hook', name: 'Hook', w: 6, h: 10, pegs: [[0, 0], [0, 4]], fixed: true, colors: ['gray', 'white'], detail: 'Clips into two holes, one above the other' },
  { id: 'long-hook', name: 'Long hook', w: 3, h: 7, pegs: [[0, 0], [0, 4]], fixed: true, colors: ['gray', 'white'], detail: 'Two holes, arm sticks straight out from the board' },
  { id: 'button', name: 'Button', w: 2.4, h: 2.4, pegs: [[0, 0]], top: 1.2, fixed: true, colors: ['white', 'gray'], detail: 'Round knob in a single hole' },
  { id: 'shelf', name: 'Shelf', w: 28, h: 4.5, pegs: [[0, 0], [24, 0], [0, 4], [24, 4]], top: 1, left: 2, fixed: true, colors: ['black', 'white'], detail: '28 × 11 cm tray; each end clips into a top and a bottom hole' },
  { id: 'cup', name: 'Cup', w: 7.6, h: 8.3, pegs: [[0, 0], [4, 0]], top: 1, fixed: true, colors: ['black', 'white'], detail: '7.6 × 8.9 cm container on two hooks in the same row' },
  { id: 'clip', name: 'Clip', w: 1.9, h: 8.3, pegs: [[0, 0]], top: 1, fixed: true, colors: ['black', 'white'], detail: 'Spring clip for notes and photos, one hole' },
  { id: 'elastic-cord', name: 'Elastic cord', w: 27.3, h: 1.6, pegs: [[0, 0], [24, 0]], top: 0.8, left: 1.65, detail: '27 cm gray cord; a peg at each end clips into a hole' },
]

export const BOARD_SIZES: Record<BoardSize, [number, number]> = { '36x56': [36, 56], '56x56': [56, 56], '76x56': [76, 56] }
/** Width × height as IKEA US lists them. */
export const BOARD_INCHES: Record<BoardSize, string> = { '36x56': '14¼ × 22', '56x56': '22 × 22', '76x56': '30 × 22' }
export const FINISHES: Finish[] = ['white', 'black', 'wood']
/** Boards sit on an open canvas; this only bounds coordinates read from untrusted saved/shared data, in cm. */
export const CANVAS_LIMIT = 5000

/** Pieces the user made, kept in the layout; usePlanner keeps this in sync with the current layout. */
let customAccessories: Accessory[] = []
export function setCustomAccessories(list: Accessory[] = []) { customAccessories = list }

export function accessory(type: string): Accessory | undefined {
  return ACCESSORIES.find(item => item.id === type) ?? customAccessories.find(item => item.id === type)
}
export const isCustom = (type: string): type is `custom-${string}` => type.startsWith('custom-')
export const MAX_CUSTOM = 20
export const CUSTOM_SIZE_LIMIT = 40

/** Validates custom pieces from untrusted data. Pegs must sit on the staggered hole grid relative to the first one. */
// oxlint-disable-next-line typescript/no-explicit-any
export function sanitizeCustom(input: any): Accessory[] {
  if (!Array.isArray(input)) return []
  const result: Accessory[] = []
  for (const entry of input.slice(0, MAX_CUSTOM)) {
    const id = String(entry?.id ?? '')
    if (!/^custom-[\w-]{1,60}$/.test(id) || result.some(other => other.id === id)) continue
    const w = clamp(Number(entry.w) || 0, 1, CUSTOM_SIZE_LIMIT), h = clamp(Number(entry.h) || 0, 1, CUSTOM_SIZE_LIMIT)
    // oxlint-disable-next-line typescript/no-explicit-any
    const raw: [number, number][] = Array.isArray(entry.pegs) ? entry.pegs.slice(0, 40).map((peg: any) => [Number(peg?.[0]), Number(peg?.[1])]) : []
    if (!raw.length) continue
    const pegs = raw.map(([x, y]) => [x - raw[0][0], y - raw[0][1]] as [number, number])
    const onGrid = pegs.every(([x, y]) => Number.isInteger(x / 2) && Number.isInteger(y / 2) && (x / 2 + y / 2) % 2 === 0)
    if (!onGrid || new Set(pegs.map(peg => peg.join())).size !== pegs.length) continue
    const color: PieceColor = entry.colors?.[0] === 'white' ? 'white' : 'gray'
    result.push({
      id: id as AccessoryId, name: String(entry.name || 'Custom piece').slice(0, 30), w, h, pegs,
      top: clamp(Number(entry.top) || 0, 0, h), left: clamp(Number(entry.left) || 0, 0, w),
      fixed: entry.fixed !== false, colors: color === 'white' ? ['white', 'gray'] : ['gray', 'white'], detail: 'Custom accessory',
    })
  }
  return result
}
export const COLOR_NAMES: Record<PieceColor, string> = { white: 'White', gray: 'Dark gray', black: 'Black' }
/** The piece's color, falling back to its default; undefined for pieces that come in one color. */
export function pieceColor(type: AccessoryId, color?: PieceColor): PieceColor | undefined {
  const colors = accessory(type)?.colors
  return colors && (color && colors.includes(color) ? color : colors[0])
}
export function isBoardSize(size: unknown): size is BoardSize {
  return typeof size === 'string' && size in BOARD_SIZES
}
export const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), Math.max(min, max))
export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
export const nextId = () => `piece-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
