import type { AccessoryId } from './catalog'

const hookPath = 'M30 12V98c0 18-8 28-18 27-6 0-8-5-8-11'

/** Inner SVG markup for each accessory, drawn on its `ART_VIEWBOX`. */
export const ART: Record<AccessoryId, string> = {
  'wall-mount': `<circle cx="50" cy="50" r="38" fill="#4b5053" stroke="#33373a" stroke-width="5"/><circle cx="50" cy="50" r="27" fill="#575c60"/><path d="M50 35v30" stroke="#222628" stroke-width="8" stroke-linecap="round"/>`,
  hook: `<path d="${hookPath}" fill="none" stroke="#33373a" stroke-width="13" stroke-linecap="round"/><path d="${hookPath}" fill="none" stroke="#575c60" stroke-width="8" stroke-linecap="round"/>`,
}

/** Each drawing's viewBox matches its accessory's w×h at 10 units per cm, so it fills its footprint without distortion. */
export const ART_VIEWBOX: Record<AccessoryId, string> = { 'wall-mount': '0 0 100 100', hook: '0 0 60 140' }

export const artSvg = (type: AccessoryId, attributes = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${ART_VIEWBOX[type]}" ${attributes} aria-hidden="true">${ART[type]}</svg>`
