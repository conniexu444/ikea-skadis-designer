import { accessory, isCustom, type AccessoryId, type BuiltinId, type PieceColor } from './catalog'

const hookPath = 'M30 12V50c0 12-5 22-13 27-5 3-10 1-11-5'
const longHookPath = 'M15 12V48c0 7 9 7 9 0v-6'
const shelfHookPath = (x: number) => `M${x - 6} 20V10a6 6 0 0 1 12 0v4`

const SHADES = {
  gray: { edge: '#33373a', body: '#575c60', face: '#4b5053', faceEdge: '#3f4447' },
  black: { edge: '#0e1011', body: '#25282a', face: '#33373a', faceEdge: '#181a1b' },
  white: { edge: '#b9bdb9', body: '#f4f5f2', face: '#ffffff', faceEdge: '#dfe1de' },
}
type Shade = (typeof SHADES)[PieceColor]

/** Inner SVG markup for each accessory, drawn on its `ART_VIEWBOX`. */
const DRAW: Record<BuiltinId, (shade: Shade) => string> = {
  'wall-mount': () => `<circle cx="50" cy="50" r="38" fill="#4b5053" stroke="#33373a" stroke-width="5"/><circle cx="50" cy="50" r="27" fill="#575c60"/><path d="M50 35v30" stroke="#222628" stroke-width="8" stroke-linecap="round"/>`,
  hook: s => `<path d="${hookPath}" fill="none" stroke="${s.edge}" stroke-width="13" stroke-linecap="round"/><path d="${hookPath}" fill="none" stroke="${s.body}" stroke-width="8" stroke-linecap="round"/>`,
  'long-hook': s => `<path d="${longHookPath}" fill="none" stroke="${s.edge}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><path d="${longHookPath}" fill="none" stroke="${s.body}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`,
  shelf: s => [20, 260].map(x => `<path d="${shelfHookPath(x)}" fill="none" stroke="${s.edge}" stroke-width="6" stroke-linecap="round"/><path d="${shelfHookPath(x)}" fill="none" stroke="${s.body}" stroke-width="3" stroke-linecap="round"/>`).join('')
    + `<rect x="2" y="15" width="276" height="28" rx="11" fill="${s.body}" stroke="${s.edge}" stroke-width="2"/><rect x="10" y="19" width="260" height="6" rx="3" fill="${s.face}" stroke="${s.faceEdge}" stroke-width="1"/>`,
  cup: s => [18, 58].map(x => `<path d="M${x - 5} 10V8a5 5 0 0 1 10 0v2" fill="none" stroke="${s.edge}" stroke-width="3" stroke-linecap="round"/>`).join('')
    + `<rect x="1" y="6" width="74" height="76" rx="13" fill="${s.body}" stroke="${s.edge}" stroke-width="1.5"/><rect x="6" y="10" width="64" height="7" rx="3.5" fill="${s.face}" stroke="${s.faceEdge}" stroke-width="1"/>`,
  clip: s => `<rect x="1" y="1" width="17" height="81" rx="8.5" fill="${s.body}" stroke="${s.edge}" stroke-width="1.2"/>`,
  'elastic-cord': () => `<path d="M16.5 8H256.5" stroke="#3f4447" stroke-width="5" stroke-linecap="round"/><path d="M16.5 8H256.5" stroke="#7a7f83" stroke-width="3" stroke-linecap="round"/>`
    + [16.5, 256.5].map(x => `<circle cx="${x}" cy="8" r="7" fill="#575c60" stroke="#33373a" stroke-width="1.5"/><circle cx="${x}" cy="8" r="3" fill="#4b5053"/>`).join(''),
  'mx-holder': s => `<path d="M44 11V46q0 7 8 7q8 0 8-7V11" fill="${s.body}" stroke="${s.edge}" stroke-width="1"/><rect x="47" y="13" width="10" height="34" rx="5" fill="${s.face}" stroke="${s.faceEdge}" stroke-width="0.6"/>`
    + `<rect x="0.5" y="0.5" width="93.5" height="11" rx="5.5" fill="${s.body}" stroke="${s.edge}" stroke-width="1"/><rect x="4" y="3" width="86.5" height="4" rx="2" fill="${s.face}" stroke="${s.faceEdge}" stroke-width="0.6"/>`,
  'keyboard-holder': s => `<rect x="0.5" y="0.5" width="9" height="98.4" rx="3" fill="${s.body}" stroke="${s.edge}" stroke-width="0.8"/><rect x="3" y="4" width="4" height="64" rx="2" fill="${s.face}" stroke="${s.faceEdge}" stroke-width="0.5"/>`
    + `<rect x="1.5" y="76" width="7" height="20" rx="2.5" fill="${s.face}" stroke="${s.faceEdge}" stroke-width="0.6"/>`,
  'controller-holder': s => `<rect x="0.5" y="0.5" width="56" height="36" rx="4" fill="${s.body}" stroke="${s.edge}" stroke-width="0.8"/><path d="M3 9H54" stroke="${s.faceEdge}" stroke-width="0.6"/>`
    + `<rect x="3" y="20" width="51" height="14" rx="3" fill="${s.face}" stroke="${s.faceEdge}" stroke-width="0.6"/>`,
  button: s => `<circle cx="12" cy="12" r="11" fill="${s.body}" stroke="${s.edge}" stroke-width="1.2"/><circle cx="12" cy="12" r="7.5" fill="${s.face}" stroke="${s.faceEdge}" stroke-width="1"/>`,
}

/** An elastic cord between two peg points given in cm; drawn on a viewBox in cm. */
export function cordArt([[x1, y1], [x2, y2]]: [number, number][]) {
  const line = `M${x1} ${y1}L${x2} ${y2}`
  return `<path class="cord-hit" d="${line}" stroke="transparent" stroke-width="1.6" stroke-linecap="round"/><path d="${line}" stroke="#3f4447" stroke-width="0.5" stroke-linecap="round"/><path d="${line}" stroke="#7a7f83" stroke-width="0.3" stroke-linecap="round"/>`
    + [[x1, y1], [x2, y2]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="0.7" fill="#575c60" stroke="#33373a" stroke-width="0.15"/><circle cx="${x}" cy="${y}" r="0.3" fill="#4b5053"/>`).join('')
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
const ART_VIEWBOX: Record<BuiltinId, string> = { 'wall-mount': '0 0 100 100', hook: '0 0 60 100', 'long-hook': '0 0 30 70', button: '0 0 24 24', shelf: '0 0 280 45', cup: '0 0 76 83', clip: '0 0 19 83', 'elastic-cord': '0 0 273 16', 'mx-holder': '0 0 94.5 54', 'keyboard-holder': '0 0 10 99.4', 'controller-holder': '0 0 57 37' }
export function artViewBox(type: AccessoryId) {
  if (!isCustom(type)) return ART_VIEWBOX[type]
  const a = accessory(type)
  return a ? `0 0 ${a.w * 10} ${a.h * 10}` : '0 0 10 10'
}

export const artSvg = (type: AccessoryId, color: PieceColor | undefined, attributes = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${artViewBox(type)}" ${attributes} aria-hidden="true">${art(type, color)}</svg>`
