import type { CSSProperties } from 'react'
import { ART, ART_VIEWBOX } from '../lib/art'
import type { AccessoryId } from '../lib/catalog'

export function Art({ type, style }: { type: AccessoryId; style?: CSSProperties }) {
  return <svg viewBox={ART_VIEWBOX[type]} aria-hidden="true" style={style} dangerouslySetInnerHTML={{ __html: ART[type] }} />
}
