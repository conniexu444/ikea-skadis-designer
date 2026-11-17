import type { CSSProperties } from 'react'
import { art, artViewBox, cordArt } from '../lib/art'
import { pieceColor, type AccessoryId, type PieceColor } from '../lib/catalog'

/** An elastic cord between two peg points, in cm within a w × h cm box. */
export function CordArt({ points, w, h }: { points: [number, number][]; w: number; h: number }) {
  return <svg viewBox={`0 0 ${w} ${h}`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: cordArt(points) }} />
}

export function Art({ type, color, style }: { type: AccessoryId; color?: PieceColor; style?: CSSProperties }) {
  return <svg viewBox={artViewBox(type)} aria-hidden="true" style={style} dangerouslySetInnerHTML={{ __html: art(type, pieceColor(type, color)) }} />
}
