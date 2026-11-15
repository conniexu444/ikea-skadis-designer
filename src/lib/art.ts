import type { AccessoryId } from './catalog'

const white = '#f8f9f6', edge = '#aab4b0', shade = '#e3e9e5', dark = '#6d8281'
const dot = `<circle cx="50" cy="16" r="5" fill="${dark}"/>`

/** Inner SVG markup for each accessory, drawn on a 100×100 viewBox. */
export const ART: Record<AccessoryId, string> = {
  hook: `${dot}<path d="M50 17v37c0 17-6 27-20 27-10 0-16-6-16-15" fill="none" stroke="${white}" stroke-width="14" stroke-linecap="round"/><path d="M50 17v37c0 17-6 27-20 27-10 0-16-6-16-15" fill="none" stroke="${edge}" stroke-width="2" stroke-linecap="round"/>`,
  'double-hook': `<circle cx="35" cy="18" r="4" fill="${dark}"/><circle cx="65" cy="18" r="4" fill="${dark}"/><path d="M35 18v36c0 14-7 23-18 23M65 18v36c0 14 7 23 18 23" fill="none" stroke="${white}" stroke-width="13" stroke-linecap="round"/><path d="M35 18v36c0 14-7 23-18 23M65 18v36c0 14 7 23 18 23" fill="none" stroke="${edge}" stroke-width="2" stroke-linecap="round"/>`,
  container: `<path d="M24 30h52l-7 58H31z" fill="${white}" stroke="${edge}" stroke-width="3"/><path d="M22 30h56" stroke="${shade}" stroke-width="9" stroke-linecap="round"/><path d="M35 42v35M50 42v35M65 42v35" stroke="${shade}" stroke-width="2"/><path d="M31 15v13M69 15v13" stroke="${dark}" stroke-width="4" stroke-linecap="round"/>`,
  shelf: `<path d="M10 43h80v17H10z" fill="${white}" stroke="${edge}" stroke-width="3"/><path d="M14 60h72l-7 13H21z" fill="${shade}" stroke="${edge}" stroke-width="2"/><path d="M22 19v23M78 19v23" stroke="${white}" stroke-width="8" stroke-linecap="round"/><path d="M22 19v23M78 19v23" stroke="${edge}" stroke-width="2" stroke-linecap="round"/>`,
  basket: `<path d="M12 28h76l-8 60H20z" fill="${white}" stroke="${edge}" stroke-width="3"/><path d="M14 31h72M21 48h58M19 66h62M29 30l4 54M43 30l2 55M57 30l-2 55M71 30l-4 54" stroke="${edge}" stroke-width="1.5"/><path d="M12 27h76" stroke="${shade}" stroke-width="7" stroke-linecap="round"/><path d="M24 14v12M76 14v12" stroke="${dark}" stroke-width="3" stroke-linecap="round"/>`,
  clip: `<path d="M50 12v21" stroke="${dark}" stroke-width="5" stroke-linecap="round"/><path d="M33 37h34l6 27-23 22-23-22z" fill="${white}" stroke="${edge}" stroke-width="3"/><path d="M36 45h28M40 55h20" stroke="${shade}" stroke-width="3"/><circle cx="50" cy="37" r="8" fill="${shade}" stroke="${edge}" stroke-width="2"/>`,
  'letter-holder': `<path d="M12 24h76v62H12z" fill="${white}" stroke="${edge}" stroke-width="3"/><path d="M12 55 50 73l38-18" fill="none" stroke="${edge}" stroke-width="3"/><path d="M20 32h60M26 40h48" stroke="${shade}" stroke-width="3"/><path d="M22 15v9M78 15v9" stroke="${dark}" stroke-width="4" stroke-linecap="round"/>`,
  elastic: `<circle cx="15" cy="19" r="6" fill="${white}" stroke="${dark}" stroke-width="3"/><circle cx="85" cy="19" r="6" fill="${white}" stroke="${dark}" stroke-width="3"/><circle cx="15" cy="81" r="6" fill="${white}" stroke="${dark}" stroke-width="3"/><circle cx="85" cy="81" r="6" fill="${white}" stroke="${dark}" stroke-width="3"/><path d="M15 19 85 81M85 19 15 81" fill="none" stroke="#8d9f9a" stroke-width="7" stroke-linecap="round"/><path d="M15 19 85 81M85 19 15 81" fill="none" stroke="${shade}" stroke-width="2"/>`,
  'wall-mount': `<circle cx="50" cy="50" r="38" fill="${white}" stroke="${edge}" stroke-width="5"/><circle cx="50" cy="50" r="27" fill="${shade}"/><path d="M35 50h30M50 35v30" stroke="${dark}" stroke-width="8" stroke-linecap="round"/>`,
}

export const artSvg = (type: AccessoryId, attributes = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" ${attributes} aria-hidden="true">${ART[type]}</svg>`
