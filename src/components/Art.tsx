import type { CSSProperties } from 'react'
import { art, artViewBox } from '../lib/art'
import { pieceColor, type AccessoryId, type PieceColor } from '../lib/catalog'

export function Art({ type, color, style }: { type: AccessoryId; color?: PieceColor; style?: CSSProperties }) {
  return <svg viewBox={artViewBox(type)} aria-hidden="true" style={style} dangerouslySetInnerHTML={{ __html: art(type, pieceColor(type, color)) }} />
}
