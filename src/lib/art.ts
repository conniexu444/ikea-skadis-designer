import type { AccessoryId } from './catalog'


/** Inner SVG markup for each accessory, drawn on a 100×100 viewBox. */
export const ART: Record<AccessoryId, string> = {
  'wall-mount': `<circle cx="50" cy="50" r="38" fill="#4b5053" stroke="#33373a" stroke-width="5"/><circle cx="50" cy="50" r="27" fill="#575c60"/><path d="M50 35v30" stroke="#222628" stroke-width="8" stroke-linecap="round"/>`,
}

export const artSvg = (type: AccessoryId, attributes = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" ${attributes} aria-hidden="true">${ART[type]}</svg>`
