import type { CSSProperties } from 'react'
import { ART } from '../lib/art'
import type { AccessoryId } from '../lib/catalog'

export function Art({ type, style }: { type: AccessoryId; style?: CSSProperties }) {
  return <svg viewBox="0 0 100 100" aria-hidden="true" style={style} dangerouslySetInnerHTML={{ __html: ART[type] }} />
}
