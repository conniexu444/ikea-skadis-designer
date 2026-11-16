import { accessory, isCustom, type AccessoryId, type BuiltinId, type PieceColor } from './catalog'

const hookPath = 'M30 12V50c0 12-5 22-13 27-5 3-10 1-11-5'
const longHookPath = 'M15 12V48c0 7 9 7 9 0v-6'

const SHADES = {
  gray: { edge: '#33373a', body: '#575c60', face: '#4b5053', faceEdge: '#3f4447' },
  white: { edge: '#b9bdb9', body: '#f4f5f2', face: '#ffffff', faceEdge: '#dfe1de' },
}
type Shade = (typeof SHADES)[PieceColor]

/** Inner SVG markup for each accessory, drawn on its `ART_VIEWBOX`. */
const DRAW: Record<BuiltinId, (shade: Shade) => string> = {
  'wall-mount': () => `<circle cx="50" cy="50" r="38" fill="#4b5053" stroke="#33373a" stroke-width="5"/><circle cx="50" cy="50" r="27" fill="#575c60"/><path d="M50 35v30" stroke="#222628" stroke-width="8" stroke-linecap="round"/>`,
  hook: s => `<path d="${hookPath}" fill="none" stroke="${s.edge}" stroke-width="13" stroke-linecap="round"/><path d="${hookPath}" fill="none" stroke="${s.body}" stroke-width="8" stroke-linecap="round"/>`,
  'long-hook': s => `<path d="${longHookPath}" fill="none" stroke="${s.edge}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><path d="${longHookPath}" fill="none" stroke="${s.body}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`,
  button: s => `<circle cx="12" cy="12" r="11" fill="${s.body}" stroke="${s.edge}" stroke-width="1.2"/><circle cx="12" cy="12" r="7.5" fill="${s.face}" stroke="${s.faceEdge}" stroke-width="1"/>`,
}

const escapeXml = (text: string) => text.replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`)

/** A custom piece is a rounded block in its color with its name on it, when the name fits. */
function drawCustom(type: AccessoryId, shade: Shade) {
  const a = accessory(type)
  if (!a) return ''
  const w = a.w * 10, h = a.h * 10, size = Math.min(h * 0.35, w * 0.85 / Math.max(1, a.name.length * 0.58))
  const label = size >= 5 ? `<text x="${w / 2}" y="${h / 2}" font-family="Inter, system-ui, sans-serif" font-size="${size}" font-weight="600" text-anchor="middle" dominant-baseline="central" fill="${shade === SHADES.white ? '#4b5053' : '#eef0ee'}">${escapeXml(a.name)}</text>` : ''
  return `<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="${Math.min(w, h) * 0.18}" fill="${shade.body}" stroke="${shade.edge}" stroke-width="1.5"/>${label}`
}

export const art = (type: AccessoryId, color: PieceColor = 'gray') => isCustom(type) ? drawCustom(type, SHADES[color]) : DRAW[type](SHADES[color])

/** Each drawing's viewBox matches its accessory's w×h at 10 units per cm, so it fills its footprint without distortion. */
const ART_VIEWBOX: Record<BuiltinId, string> = { 'wall-mount': '0 0 100 100', hook: '0 0 60 100', 'long-hook': '0 0 30 70', button: '0 0 24 24' }
export function artViewBox(type: AccessoryId) {
  if (!isCustom(type)) return ART_VIEWBOX[type]
  const a = accessory(type)
  return a ? `0 0 ${a.w * 10} ${a.h * 10}` : '0 0 10 10'
}

export const artSvg = (type: AccessoryId, color: PieceColor | undefined, attributes = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${artViewBox(type)}" ${attributes} aria-hidden="true">${art(type, color)}</svg>`
