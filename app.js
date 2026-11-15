const HOLE_PITCH = 2, HOLE_MARGIN = 2;
const ACCESSORIES = [
  { id: 'wall-mount', name: 'Wall mount', group: 'mounting', w: 2, h: 2, top: 1, pegs: [[0, 0]], detail: 'Screws the board to the wall' },
  { id: 'hook', name: 'Hook', group: 'small', w: 7, h: 8, pegs: [[0, 0]], detail: 'For headphones, keys & more' },
  { id: 'double-hook', name: 'Double hook', group: 'small', w: 13, h: 8, pegs: [[0, 0], [4, 0]], detail: 'A little extra hanging room' },
  { id: 'container', name: 'Container', group: 'storage', w: 14, h: 16, pegs: [[0, 0], [8, 0]], detail: 'For pens and small things' },
  { id: 'shelf', name: 'Shelf', group: 'display', w: 28, h: 8, pegs: [[0, 0], [24, 0]], detail: 'Keep favorites on show' },
  { id: 'basket', name: 'Mesh basket', group: 'storage', w: 24, h: 16, pegs: [[0, 0], [16, 0]], detail: 'An open home for essentials' },
  { id: 'clip', name: 'Clip', group: 'small', w: 7, h: 9, pegs: [[0, 0]], detail: 'Pin a note or photo' },
  { id: 'letter-holder', name: 'Letter holder', group: 'storage', w: 20, h: 17, pegs: [[0, 0], [12, 0]], detail: 'Tidy papers and mail' },
  { id: 'elastic', name: 'Elastic cord', group: 'display', w: 20, h: 12, pegs: [[0, 0], [16, 0], [0, 8], [16, 8]], top: 2, detail: 'Tuck things into place' }
];
const BOARD_SIZES = { '36x56': [36, 56], '56x56': [56, 56], '76x56': [76, 56] };
const WORLD_W = 170, WORLD_H = 82;
const STORAGE_KEY = 'skadis-studio-v3';
const ISSUE_MESSAGES = { taken: 'Those holes are already in use — each hole can only hold one thing', edge: 'That piece doesn’t fit there on the board' };
const cornerMounts = (prefix, boardId) => [[1, 1], [25, 1], [1, 25], [25, 25]].map(([col, row], i) => ({ id: `${prefix}-mount-${i + 1}`, boardId, type: 'wall-mount', col, row, rotation: 0 }));
const DEFAULT_STATE = {
  name: 'My perfect setup',
  boards: [
    { id: 'board-1', size: '56x56', color: 'white', x: 22, y: 15 },
    { id: 'board-2', size: '56x56', color: 'white', x: 85, y: 15 }
  ],
  items: [
    ...cornerMounts('sample-1', 'board-1'),
    ...cornerMounts('sample-2', 'board-2'),
    { id: 'sample-1', boardId: 'board-1', type: 'clip', col: 4, row: 4, rotation: 0 },
    { id: 'sample-2', boardId: 'board-1', type: 'container', col: 6, row: 16, rotation: 0 },
    { id: 'sample-3', boardId: 'board-2', type: 'hook', col: 20, row: 4, rotation: 0 },
    { id: 'sample-4', boardId: 'board-2', type: 'basket', col: 4, row: 6, rotation: 0 },
    { id: 'sample-5', boardId: 'board-2', type: 'shelf', col: 6, row: 20, rotation: 0 }
  ]
};
const $ = (selector) => document.querySelector(selector);
const boardArea = $('#boardArea');
const boardLayer = $('#boardLayer');
const catalogList = $('#catalogList');
let state = readInitialState();
let selectedId = null;
let selectedBoardId = state.boards[0].id;
let filter = 'all';
let query = '';
let dragging = null;
let undoStack = [];
let redoStack = [];
let toastTimer;

function readInitialState() {
  const shared = location.hash.startsWith('#layout=') ? decodeState(location.hash.slice(8)) : null;
  if (shared) return shared;
  for (const key of [STORAGE_KEY, 'skadis-studio-v2', 'skadis-studio-v1']) {
    try { const loaded = sanitizeState(JSON.parse(localStorage.getItem(key))); if (loaded) return loaded; }
    catch { /* try the next saved version */ }
  }
  return structuredClone(DEFAULT_STATE);
}
function decodeState(value) {
  try { return sanitizeState(JSON.parse(decodeURIComponent(value))); }
  catch { return null; }
}
function sanitizeState(input) {
  if (!input || !Array.isArray(input.items)) return null;
  const validColor = color => ['white', 'black', 'wood'].includes(color) ? color : 'white';
  let boards;
  if (Array.isArray(input.boards) && input.boards.length) {
    boards = input.boards.slice(0, 2).filter(board => BOARD_SIZES[board.size]).map((board, i) => ({
      id: `board-${i + 1}`, size: board.size, color: validColor(board.color),
      x: clamp(Number(board.x) || 0, 0, WORLD_W - BOARD_SIZES[board.size][0]),
      y: clamp(Number(board.y) || 0, 0, WORLD_H - 56)
    }));
  } else if (BOARD_SIZES[input.size]) {
    const w = BOARD_SIZES[input.size][0];
    boards = [{ id: 'board-1', size: input.size, color: validColor(input.color), x: 12, y: 13 }, { id: 'board-2', size: '56x56', color: validColor(input.color), x: 20 + w, y: 13 }];
  }
  if (!boards?.length) return null;
  if (boards.length > 1 && boardRectOverlaps(boards[0], boards[1])) boards[1].x = clamp(boards[0].x + BOARD_SIZES[boards[0].size][0], 0, WORLD_W - BOARD_SIZES[boards[1].size][0]);
  const items = [];
  input.items.slice(0, 200).forEach((item, i) => {
    const a = accessory(item?.type); if (!a) return;
    const rotation = Number(item.rotation) === 90 ? 90 : 0;
    const boardIndex = Array.isArray(input.boards) ? input.boards.findIndex(board => board.id === item.boardId) : 0;
    const board = boards[Math.max(0, Math.min(boardIndex, boards.length - 1))];
    let col = Number(item.col), row = Number(item.row);
    if (!Number.isInteger(col) || !Number.isInteger(row)) [col, row] = anchorFor(board.size, a.id, rotation, Number(item.x) || 0, Number(item.y) || 0);
    if (placementIssue(board, a.id, rotation, col, row, usedHoles(items, board))) {
      const spot = findSpot(board, items, a.id, rotation, [col, row]);
      if (!spot) return;
      [col, row] = spot;
    }
    items.push({ id: String(item.id || `loaded-${i}`).slice(0, 80), boardId: board.id, type: a.id, col, row, rotation });
  });
  return { name: String(input.name || 'My perfect setup').slice(0, 60), boards, items };
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { $('#saveStatus').textContent = 'Storage unavailable — download or share your layout'; }
}
function snapshot() { return structuredClone(state); }
function commit(change) {
  undoStack.push(snapshot()); if (undoStack.length > 80) undoStack.shift();
  redoStack = []; change(); save(); render();
}
function clamp(n, min, max) { return Math.min(Math.max(n, min), Math.max(min, max)); }
function accessory(type) { return ACCESSORIES.find(item => item.id === type); }
function currentBoard() { return state.boards.find(board => board.id === selectedBoardId) || state.boards[0]; }
function boardRectOverlaps(a, b) { const aw = BOARD_SIZES[a.size][0], bw = BOARD_SIZES[b.size][0]; return a.x < b.x + bw && a.x + aw > b.x && a.y < b.y + 56 && a.y + 56 > b.y; }
function escapeHTML(str) { return String(str).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
function nextId() { return `piece-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function plural(n, word) { return `${n} ${word}${n === 1 ? '' : 's'}`; }

// SKÅDIS holes sit on a staggered grid: 2 cm apart diagonally, so holes in the same row or column are 4 cm apart.
// The 36×56 board has 28 rows alternating 9 and 8 holes (8 on the bottom row), so 14 holes in every column.
const HOLE_LAYOUTS = { '36x56': { rows: 28, y0: 1 } };
function holeGrid(size) {
  const [bw, bh] = BOARD_SIZES[size], layout = HOLE_LAYOUTS[size] || {};
  return {
    cols: layout.cols ?? Math.round((bw - 2 * HOLE_MARGIN) / HOLE_PITCH) + 1,
    rows: layout.rows ?? Math.round((bh - 2 * HOLE_MARGIN) / HOLE_PITCH) + 1,
    x0: layout.x0 ?? HOLE_MARGIN,
    y0: layout.y0 ?? HOLE_MARGIN
  };
}
function holeExists(size, col, row) {
  const { cols, rows } = holeGrid(size);
  return Number.isInteger(col) && Number.isInteger(row) && col >= 0 && row >= 0 && col < cols && row < rows && (col + row) % 2 === 0;
}
function holePoint(size, col, row) { const { x0, y0 } = holeGrid(size); return [x0 + col * HOLE_PITCH, y0 + row * HOLE_PITCH]; }
function holeKey(col, row) { return `${col},${row}`; }
function allHoles(size) {
  const { cols, rows } = holeGrid(size), holes = [];
  for (let row = 0; row < rows; row++) for (let col = row % 2; col < cols; col += 2) holes.push([col, row]);
  return holes;
}
function geometry(type, rotation = 0) {
  const a = accessory(type), xs = a.pegs.map(peg => peg[0]), ys = a.pegs.map(peg => peg[1]);
  const ox = (Math.min(...xs) + Math.max(...xs)) / 2 - a.w / 2, oy = Math.min(...ys) - (a.top ?? 1.5);
  const pegs = a.pegs.map(([x, y]) => rotation === 90 ? [-y, x] : [x, y]);
  return { pegs, rect: rotation === 90 ? [-(oy + a.h), ox, a.h, a.w] : [ox, oy, a.w, a.h] };
}
function placement(size, type, rotation, col, row) {
  const { pegs, rect } = geometry(type, rotation), [ax, ay] = holePoint(size, col, row);
  return { holes: pegs.map(([x, y]) => [col + x / HOLE_PITCH, row + y / HOLE_PITCH]), rect: [ax + rect[0], ay + rect[1], rect[2], rect[3]] };
}
function itemPlacement(item, size) { return placement(size, item.type, item.rotation, item.col, item.row); }
function usedHoles(items, board, ignoreId = null) {
  const used = new Set();
  items.forEach(item => { if (item.boardId === board.id && item.id !== ignoreId) itemPlacement(item, board.size).holes.forEach(([col, row]) => used.add(holeKey(col, row))); });
  return used;
}
function placementIssue(board, type, rotation, col, row, used) {
  const { holes, rect } = placement(board.size, type, rotation, col, row), [bw, bh] = BOARD_SIZES[board.size], eps = 1e-6;
  const fits = holes.every(([c, r]) => holeExists(board.size, c, r)) && rect[0] >= -eps && rect[1] >= -eps && rect[0] + rect[2] <= bw + eps && rect[1] + rect[3] <= bh + eps;
  if (!fits) return 'edge';
  return holes.some(([c, r]) => used.has(holeKey(c, r))) ? 'taken' : null;
}
function nearestHole(size, x, y) {
  const { cols, rows, x0, y0 } = holeGrid(size), fc = (x - x0) / HOLE_PITCH, fr = (y - y0) / HOLE_PITCH;
  let best = null, bestDistance = Infinity;
  for (let col = Math.floor(fc) - 1; col <= Math.ceil(fc) + 1; col++) for (let row = Math.floor(fr) - 1; row <= Math.ceil(fr) + 1; row++) {
    const c = clamp(col, 0, cols - 1), r = clamp(row, 0, rows - 1);
    if (!holeExists(size, c, r)) continue;
    const distance = Math.hypot(c - fc, r - fr);
    if (distance < bestDistance) { best = [c, r]; bestDistance = distance; }
  }
  return best || [0, 0];
}
function anchorFor(size, type, rotation, x, y) { const { rect } = geometry(type, rotation); return nearestHole(size, x - rect[0], y - rect[1]); }
function findSpot(board, items, type, rotation, near = null, ignoreId = null) {
  const used = usedHoles(items, board, ignoreId), holes = allHoles(board.size);
  if (near) holes.sort((a, b) => Math.hypot(a[0] - near[0], (a[1] - near[1]) * 1.01) - Math.hypot(b[0] - near[0], (b[1] - near[1]) * 1.01));
  return holes.find(([col, row]) => !placementIssue(board, type, rotation, col, row, used)) || null;
}
function holeStats(board) { return { used: usedHoles(state.items, board).size, total: allHoles(board.size).length }; }

function art(type, attributes = '') {
  const white = '#f8f9f6', edge = '#aab4b0', shade = '#e3e9e5', dark = '#6d8281';
  const start = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" ${attributes} aria-hidden="true">`;
  const end = '</svg>';
  const dot = `<circle cx="50" cy="16" r="5" fill="${dark}"/>`;
  const shapes = {
    hook: `${dot}<path d="M50 17v37c0 17-6 27-20 27-10 0-16-6-16-15" fill="none" stroke="${white}" stroke-width="14" stroke-linecap="round"/><path d="M50 17v37c0 17-6 27-20 27-10 0-16-6-16-15" fill="none" stroke="${edge}" stroke-width="2" stroke-linecap="round"/>`,
    'double-hook': `<circle cx="35" cy="18" r="4" fill="${dark}"/><circle cx="65" cy="18" r="4" fill="${dark}"/><path d="M35 18v36c0 14-7 23-18 23M65 18v36c0 14 7 23 18 23" fill="none" stroke="${white}" stroke-width="13" stroke-linecap="round"/><path d="M35 18v36c0 14-7 23-18 23M65 18v36c0 14 7 23 18 23" fill="none" stroke="${edge}" stroke-width="2" stroke-linecap="round"/>`,
    container: `<path d="M24 30h52l-7 58H31z" fill="${white}" stroke="${edge}" stroke-width="3"/><path d="M22 30h56" stroke="${shade}" stroke-width="9" stroke-linecap="round"/><path d="M35 42v35M50 42v35M65 42v35" stroke="${shade}" stroke-width="2"/><path d="M31 15v13M69 15v13" stroke="${dark}" stroke-width="4" stroke-linecap="round"/>`,
    shelf: `<path d="M10 43h80v17H10z" fill="${white}" stroke="${edge}" stroke-width="3"/><path d="M14 60h72l-7 13H21z" fill="${shade}" stroke="${edge}" stroke-width="2"/><path d="M22 19v23M78 19v23" stroke="${white}" stroke-width="8" stroke-linecap="round"/><path d="M22 19v23M78 19v23" stroke="${edge}" stroke-width="2" stroke-linecap="round"/>`,
    basket: `<path d="M12 28h76l-8 60H20z" fill="${white}" stroke="${edge}" stroke-width="3"/><path d="M14 31h72M21 48h58M19 66h62M29 30l4 54M43 30l2 55M57 30l-2 55M71 30l-4 54" stroke="${edge}" stroke-width="1.5"/><path d="M12 27h76" stroke="${shade}" stroke-width="7" stroke-linecap="round"/><path d="M24 14v12M76 14v12" stroke="${dark}" stroke-width="3" stroke-linecap="round"/>`,
    clip: `<path d="M50 12v21" stroke="${dark}" stroke-width="5" stroke-linecap="round"/><path d="M33 37h34l6 27-23 22-23-22z" fill="${white}" stroke="${edge}" stroke-width="3"/><path d="M36 45h28M40 55h20" stroke="${shade}" stroke-width="3"/><circle cx="50" cy="37" r="8" fill="${shade}" stroke="${edge}" stroke-width="2"/>`,
    'letter-holder': `<path d="M12 24h76v62H12z" fill="${white}" stroke="${edge}" stroke-width="3"/><path d="M12 55 50 73l38-18" fill="none" stroke="${edge}" stroke-width="3"/><path d="M20 32h60M26 40h48" stroke="${shade}" stroke-width="3"/><path d="M22 15v9M78 15v9" stroke="${dark}" stroke-width="4" stroke-linecap="round"/>`,
    elastic: `<circle cx="15" cy="19" r="6" fill="${white}" stroke="${dark}" stroke-width="3"/><circle cx="85" cy="19" r="6" fill="${white}" stroke="${dark}" stroke-width="3"/><circle cx="15" cy="81" r="6" fill="${white}" stroke="${dark}" stroke-width="3"/><circle cx="85" cy="81" r="6" fill="${white}" stroke="${dark}" stroke-width="3"/><path d="M15 19 85 81M85 19 15 81" fill="none" stroke="#8d9f9a" stroke-width="7" stroke-linecap="round"/><path d="M15 19 85 81M85 19 15 81" fill="none" stroke="${shade}" stroke-width="2"/>`,
    'wall-mount': `<circle cx="50" cy="50" r="38" fill="${white}" stroke="${edge}" stroke-width="5"/><circle cx="50" cy="50" r="27" fill="${shade}"/><path d="M35 50h30M50 35v30" stroke="${dark}" stroke-width="8" stroke-linecap="round"/>`,
  };
  return start + shapes[type] + end;
}
function renderCatalog() {
  const visible = ACCESSORIES.filter(a => (filter === 'all' || a.group === filter) && `${a.name} ${a.detail}`.toLowerCase().includes(query));
  $('#catalogCount').textContent = plural(visible.length, 'piece');
  catalogList.innerHTML = visible.length ? visible.map(a => `<div class="catalog-card" data-type="${a.id}" role="group" aria-label="${a.name}"><div class="catalog-thumb">${art(a.id)}</div><div class="catalog-info"><strong>${a.name}</strong><small>${a.detail}</small><small class="hole-count">Uses ${plural(a.pegs.length, 'hole')}</small></div><button class="add-button" data-add="${a.id}" type="button" aria-label="Add ${a.name}">+</button></div>`).join('') : '<p class="catalog-empty">No accessories match that search.</p>';
}
function slot(size, col, row, attributes = '') { const [x, y] = holePoint(size, col, row); return `<rect x="${x - 0.25}" y="${y - 0.75}" width="0.5" height="1.5" rx="0.25" ${attributes}/>`; }
function renderBoards() {
  const holesUsed = state.boards.reduce((sum, board) => sum + holeStats(board).used, 0), holesTotal = state.boards.reduce((sum, board) => sum + holeStats(board).total, 0);
  $('#sizeLabel').textContent = `${plural(state.boards.length, 'board')} · ${holesUsed} of ${holesTotal} holes used`;
  boardLayer.innerHTML = state.boards.map((board, index) => {
    const [bw, bh] = BOARD_SIZES[board.size], items = state.items.filter(item => item.boardId === board.id);
    const pieces = items.map(item => {
      const a = accessory(item.type), [x, y, w, h] = itemPlacement(item, board.size).rect, rotated = item.rotation === 90;
      const svg = art(item.type, rotated ? `style="position:absolute;left:50%;top:50%;width:${a.w / w * 100}%;height:${a.h / h * 100}%;transform:translate(-50%,-50%) rotate(90deg)"` : '');
      return `<div class="board-item ${item.id === selectedId ? 'selected' : ''} ${dragging?.id === item.id ? 'dragging' : ''}" data-id="${escapeHTML(item.id)}" tabindex="0" role="button" aria-label="${a.name}, uses ${plural(a.pegs.length, 'hole')}, select and drag to move" style="left:${x / bw * 100}%;top:${y / bh * 100}%;width:${w / bw * 100}%;height:${h / bh * 100}%">${svg}</div>`;
    }).join('');
    const holes = allHoles(board.size).map(([col, row]) => slot(board.size, col, row)).join('');
    const pegs = items.filter(item => item.type !== 'wall-mount').map(item => itemPlacement(item, board.size).holes.map(([col, row]) => slot(board.size, col, row, `class="peg ${item.id === selectedId ? 'active' : ''}" vector-effect="non-scaling-stroke"`)).join('')).join('');
    const svgLayer = (className, content) => `<svg class="${className}" viewBox="0 0 ${bw} ${bh}" preserveAspectRatio="none" aria-hidden="true">${content}</svg>`;
    return `<div class="board-wrap ${board.id === selectedBoardId ? 'selected-board' : ''} ${dragging?.kind === 'board' && dragging.id === board.id ? 'board-moving' : ''}" data-board-id="${board.id}" style="left:${board.x / WORLD_W * 100}%;top:${board.y / WORLD_H * 100}%;width:${bw / WORLD_W * 100}%;height:${bh / WORLD_H * 100}%"><button class="board-grip" type="button" data-grip="${board.id}" aria-label="Drag board ${index + 1} to move it"><span class="grip-dots" aria-hidden="true">⠿</span> Board ${index + 1}</button><div class="board board-${board.color}" role="group" aria-label="Board ${index + 1}, ${bw} by ${bh} centimeters, ${board.color}"><span class="board-index">BOARD ${String(index + 1).padStart(2, '0')}</span>${svgLayer('board-holes', holes)}<div class="board-items">${pieces}</div>${svgLayer('board-pegs', `${pegs}<g class="peg-preview"></g>`)}</div></div>`;
  }).join('');
}
function renderBoardSelector() {
  $('#boardSelector').innerHTML = state.boards.map((board, i) => { const { used, total } = holeStats(board); return `<button class="board-select ${board.id === selectedBoardId ? 'active' : ''}" data-select-board="${board.id}" type="button" aria-pressed="${board.id === selectedBoardId}"><strong>Board ${i + 1}</strong><small>${board.size.replace('x', ' × ')} cm · ${board.color}</small><span class="meter" aria-hidden="true"><i style="width:${used / total * 100}%"></i></span><small>${used} / ${total} holes used</small></button>`; }).join('');
  $('#addBoardButton').disabled = state.boards.length >= 2;
  $('#removeBoardButton').disabled = state.boards.length <= 1;
}
function renderParts() {
  const counts = new Map();
  state.items.forEach(item => counts.set(item.type, (counts.get(item.type) || 0) + 1));
  $('#partTotal').textContent = `${state.boards.length + state.items.length} pieces`;
  const boards = state.boards.map((board, i) => `<div class="part-row"><span>Board ${i + 1} · ${board.size.replace('x', ' × ')} cm</span><span>× 1</span></div>`).join('');
  const pieces = [...counts].map(([type, n]) => `<div class="part-row"><span>${accessory(type).name}</span><span>× ${n}</span></div>`).join('');
  $('#partsList').innerHTML = boards + pieces;
}
function renderSelection() {
  const panel = $('#selectionPanel');
  const item = state.items.find(item => item.id === selectedId);
  if (!item) { selectedId = null; panel.innerHTML = '<div class="selection-empty"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3l14 7-6 2-2 6z"/></svg><span>Select a piece on a board to rotate, copy, or remove it.</span></div>'; return; }
  const a = accessory(item.type);
  panel.innerHTML = `<div class="selection-heading"><span class="mini-art">${art(a.id)}</span><span><strong>${a.name}</strong><small>Uses ${plural(a.pegs.length, 'hole')}</small></span></div><div class="selection-actions"><button data-action="rotate" type="button">↻ Rotate</button><button data-action="duplicate" type="button">⧉ Copy</button><button data-action="remove" type="button">× Remove</button></div>`;
}
function fitView() {
  if (dragging?.kind === 'board') return;
  const view = boardArea.parentElement, padX = 32, padTop = 52, padBottom = 24;
  const left = Math.min(...state.boards.map(board => board.x)), right = Math.max(...state.boards.map(board => board.x + BOARD_SIZES[board.size][0]));
  const top = Math.min(...state.boards.map(board => board.y)), bottom = Math.max(...state.boards.map(board => board.y + BOARD_SIZES[board.size][1]));
  const scale = clamp(Math.min((view.clientWidth - padX * 2) / (right - left), (view.clientHeight - padTop - padBottom) / (bottom - top)), 2, 16);
  boardArea.style.width = `${WORLD_W * scale}px`;
  boardArea.style.left = `${(view.clientWidth - (right - left) * scale) / 2 - left * scale}px`;
  boardArea.style.top = `${padTop + (view.clientHeight - padTop - padBottom - (bottom - top) * scale) / 2 - top * scale}px`;
}

function render() {
  if (!state.boards.some(board => board.id === selectedBoardId)) selectedBoardId = state.boards[0].id;
  renderBoards(); renderBoardSelector(); renderParts(); renderSelection(); fitView();
  $('#projectName').value = state.name;
  document.querySelectorAll('[data-size]').forEach(button => { button.classList.toggle('active', button.dataset.size === currentBoard().size); button.setAttribute('aria-pressed', String(button.dataset.size === currentBoard().size)); });
  document.querySelectorAll('[data-color]').forEach(button => { button.classList.toggle('active', button.dataset.color === currentBoard().color); button.setAttribute('aria-pressed', String(button.dataset.color === currentBoard().color)); });
  $('#undoButton').disabled = !undoStack.length; $('#redoButton').disabled = !redoStack.length;
}
function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600); }
function addAccessory(type, spot = null, boardId = selectedBoardId) {
  const a = accessory(type); if (!a) return;
  const preferred = state.boards.find(board => board.id === boardId) || currentBoard();
  let board = preferred, position = spot;
  if (!position) {
    for (const candidate of [preferred, ...state.boards.filter(entry => entry !== preferred)]) {
      position = findSpot(candidate, state.items, type, 0);
      if (position) { board = candidate; break; }
    }
  }
  if (!position) { toast(`No free holes left for a ${a.name.toLowerCase()}`); return; }
  const id = nextId();
  commit(() => { state.items.push({ id, boardId: board.id, type, col: position[0], row: position[1], rotation: 0 }); selectedId = id; selectedBoardId = board.id; });
  toast(`${a.name} added to ${boardLabel(board.id)}${board === preferred ? '' : ' — no room left on the selected board'}`);
}
function boardLabel(id) { return `board ${state.boards.findIndex(board => board.id === id) + 1}`; }
// Pieces keep their distance from the nearest board edge, so corner mounts stay in the corners.
function refitItems(board, fromSize = board.size) {
  const kept = state.items.filter(item => item.boardId !== board.id), [ow, oh] = BOARD_SIZES[fromSize], [nw, nh] = BOARD_SIZES[board.size];
  let removed = 0;
  state.items.filter(item => item.boardId === board.id).forEach(item => {
    let { col, row } = item;
    if (fromSize !== board.size) {
      const [x, y] = holePoint(fromSize, col, row);
      [col, row] = nearestHole(board.size, x > ow / 2 ? x + nw - ow : x, y > oh / 2 ? y + nh - oh : y);
    }
    const spot = placementIssue(board, item.type, item.rotation, col, row, usedHoles(kept, board)) ? findSpot(board, kept, item.type, item.rotation, [col, row]) : [col, row];
    if (spot) kept.push({ ...item, col: spot[0], row: spot[1] }); else removed++;
  });
  state.items = kept;
  return removed;
}
function changeSize(size) {
  const board = currentBoard(); if (size === board.size) return;
  let removed = 0;
  commit(() => {
    const fromSize = board.size;
    board.size = size;
    const [bw] = BOARD_SIZES[size];
    board.x = clamp(board.x, 0, WORLD_W - bw);
    removed = refitItems(board, fromSize);
    const other = state.boards.find(entry => entry.id !== board.id);
    if (other && boardRectOverlaps(board, other)) {
      const left = board.x <= other.x ? board : other, right = left === board ? other : board;
      const leftWidth = BOARD_SIZES[left.size][0], rightWidth = BOARD_SIZES[right.size][0];
      left.x = clamp(left.x, 0, WORLD_W - leftWidth - rightWidth);
      right.x = left.x + leftWidth;
    }
  });
  if (removed) toast(`${plural(removed, 'piece')} didn’t fit the smaller board — Undo brings them back`);
}
function addBoard() {
  if (state.boards.length >= 2) return;
  const first = state.boards[0], firstWidth = BOARD_SIZES[first.size][0], size = '56x56';
  const id = `board-${Date.now()}`;
  commit(() => { first.x = clamp(first.x, 0, WORLD_W - firstWidth - 56 - 6); state.boards.push({ id, size, color: first.color, x: first.x + firstWidth + 6, y: first.y }); selectedBoardId = id; selectedId = null; });
  toast('Second board added — drag its handle to arrange it');
}
function removeBoard() {
  if (state.boards.length <= 1) return;
  const boardId = selectedBoardId;
  commit(() => { state.boards = state.boards.filter(board => board.id !== boardId); state.items = state.items.filter(item => item.boardId !== boardId); selectedBoardId = state.boards[0].id; selectedId = null; });
  toast('Board removed — Undo can restore it');
}
function selectedAction(action) {
  const item = state.items.find(item => item.id === selectedId); if (!item) return;
  const board = state.boards.find(board => board.id === item.boardId);
  if (action === 'remove') { commit(() => { state.items = state.items.filter(entry => entry.id !== item.id); selectedId = null; }); toast('Accessory removed'); }
  if (action === 'duplicate') {
    const spot = findSpot(board, state.items, item.type, item.rotation, [item.col + 2, item.row + 2]);
    if (!spot) { toast('No free holes left for a copy on this board'); return; }
    const id = nextId();
    commit(() => { state.items.push({ ...item, id, col: spot[0], row: spot[1] }); selectedId = id; });
    toast('Accessory copied');
  }
  if (action === 'rotate') {
    const rotation = item.rotation === 90 ? 0 : 90;
    const spot = placementIssue(board, item.type, rotation, item.col, item.row, usedHoles(state.items, board, item.id)) ? findSpot(board, state.items, item.type, rotation, [item.col, item.row], item.id) : [item.col, item.row];
    if (!spot) { toast('There are no free holes to rotate this piece into'); return; }
    commit(() => { item.rotation = rotation; item.col = spot[0]; item.row = spot[1]; });
  }
}
function startDrag(event, type, id = null) {
  if (event.button !== 0 || event.target.closest('button')) return;
  event.preventDefault();
  const item = id ? state.items.find(entry => entry.id === id) : null, rotation = item?.rotation || 0;
  const [, , w, h] = geometry(type, rotation).rect, pxPerCm = boardArea.getBoundingClientRect().width / WORLD_W;
  const ghost = document.createElement('div'); ghost.className = 'drag-ghost';
  ghost.style.width = `${w * pxPerCm}px`; ghost.style.height = `${h * pxPerCm}px`;
  ghost.innerHTML = art(type, rotation === 90 ? 'style="transform:rotate(90deg)"' : '');
  document.body.appendChild(ghost);
  dragging = { kind: 'piece', type, id, rotation, ghost, w, h, pxPerCm };
  selectedId = id; if (item) selectedBoardId = item.boardId;
  renderBoards(); renderBoardSelector(); renderSelection(); moveDrag(event);
}
function startBoardDrag(event, id) {
  if (event.button !== 0) return;
  event.preventDefault();
  const board = state.boards.find(board => board.id === id); if (!board) return;
  selectedBoardId = id; selectedId = null;
  dragging = { kind: 'board', id, startX: event.clientX, startY: event.clientY, x: board.x, y: board.y, previewX: board.x, previewY: board.y };
  render();
}
function snapBoard(board, x, y) {
  const [w, h] = BOARD_SIZES[board.size], other = state.boards.find(entry => entry.id !== board.id);
  x = clamp(x, 0, WORLD_W - w); y = clamp(y, 0, WORLD_H - h);
  if (!other) return { x: Math.round(x * 2) / 2, y: Math.round(y * 2) / 2, snapped: false };
  const [ow, oh] = BOARD_SIZES[other.size];
  const points = [[other.x + ow, other.y], [other.x - w, other.y], [other.x, other.y + oh], [other.x, other.y - h]];
  const valid = points.filter(([cx, cy]) => cx >= 0 && cy >= 0 && cx + w <= WORLD_W && cy + h <= WORLD_H);
  valid.sort((a, b) => Math.hypot(a[0] - x, a[1] - y) - Math.hypot(b[0] - x, b[1] - y));
  if (valid.length && Math.hypot(valid[0][0] - x, valid[0][1] - y) <= 9) return { x: valid[0][0], y: valid[0][1], snapped: true };
  return { x: Math.round(x * 2) / 2, y: Math.round(y * 2) / 2, snapped: false };
}
function dropTarget(event, drag) {
  for (const board of state.boards) {
    const rect = boardLayer.querySelector(`[data-board-id="${board.id}"] .board-items`)?.getBoundingClientRect();
    if (!rect || event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) continue;
    const [bw, bh] = BOARD_SIZES[board.size];
    const x = (event.clientX - rect.left) / rect.width * bw - drag.w / 2, y = (event.clientY - rect.top) / rect.height * bh - drag.h / 2;
    const [col, row] = anchorFor(board.size, drag.type, drag.rotation, x, y);
    return { board, col, row, issue: placementIssue(board, drag.type, drag.rotation, col, row, usedHoles(state.items, board, drag.id)) };
  }
  return null;
}
function showDropPreview(target, drag) {
  boardLayer.querySelectorAll('.peg-preview').forEach(group => { group.innerHTML = ''; });
  if (!target) return;
  const group = boardLayer.querySelector(`[data-board-id="${target.board.id}"] .peg-preview`); if (!group) return;
  const { holes, rect: [x, y, w, h] } = placement(target.board.size, drag.type, drag.rotation, target.col, target.row);
  group.setAttribute('class', `peg-preview ${target.issue ? 'blocked' : 'open'}`);
  group.innerHTML = `<rect class="preview-body" x="${x}" y="${y}" width="${w}" height="${h}" rx="0.6" vector-effect="non-scaling-stroke"/>${holes.map(([col, row]) => slot(target.board.size, col, row, 'class="preview-peg" vector-effect="non-scaling-stroke"')).join('')}`;
}
function moveDrag(event) {
  if (!dragging) return;
  if (dragging.kind === 'piece') {
    dragging.ghost.style.left = `${event.clientX - dragging.w * dragging.pxPerCm / 2}px`;
    dragging.ghost.style.top = `${event.clientY - dragging.h * dragging.pxPerCm / 2}px`;
    showDropPreview(dropTarget(event, dragging), dragging);
    return;
  }
  const drag = dragging, board = state.boards.find(board => board.id === drag.id);
  const rect = boardArea.getBoundingClientRect(), pxPerCm = rect.width / WORLD_W;
  const point = snapBoard(board, drag.x + (event.clientX - drag.startX) / pxPerCm, drag.y + (event.clientY - drag.startY) / pxPerCm);
  drag.previewX = point.x; drag.previewY = point.y;
  const wrap = boardLayer.querySelector(`[data-board-id="${drag.id}"]`);
  if (wrap) { wrap.style.left = `${point.x / WORLD_W * 100}%`; wrap.style.top = `${point.y / WORLD_H * 100}%`; wrap.classList.toggle('board-snap', point.snapped); }
}
function endDrag(event) {
  if (!dragging) return;
  const drag = dragging; dragging = null;
  if (drag.kind === 'board') {
    const board = state.boards.find(board => board.id === drag.id);
    const candidate = { ...board, x: drag.previewX, y: drag.previewY };
    const other = state.boards.find(entry => entry.id !== board.id);
    if (other && boardRectOverlaps(candidate, other)) { render(); toast('Boards cannot overlap — drag near an edge to snap them together'); return; }
    if (board.x !== candidate.x || board.y !== candidate.y) { commit(() => { board.x = candidate.x; board.y = candidate.y; }); if (other && (board.x + BOARD_SIZES[board.size][0] === other.x || other.x + BOARD_SIZES[other.size][0] === board.x)) toast('Boards snapped together'); }
    else render();
    return;
  }
  drag.ghost.remove();
  const target = dropTarget(event, drag);
  if (!target) { render(); return; }
  if (target.issue) { render(); toast(ISSUE_MESSAGES[target.issue]); return; }
  if (drag.id) { const item = state.items.find(entry => entry.id === drag.id); if (item && (item.col !== target.col || item.row !== target.row || item.boardId !== target.board.id)) commit(() => { item.col = target.col; item.row = target.row; item.boardId = target.board.id; selectedBoardId = target.board.id; }); else render(); }
  else addAccessory(drag.type, [target.col, target.row], target.board.id);
}
function downloadLayout() {
  const scale = 10, pad = 45, W = WORLD_W * scale + pad * 2, H = WORLD_H * scale + pad * 2;
  const palette = { white: ['#fafaf8', '#e7e8e4', '#b6c0ba'], black: ['#33383b', '#252d30', '#131b1e'], wood: ['#c9a87f', '#b38c64', '#785c40'] };
  const scaledSlot = (size, col, row, fill) => { const [x, y] = holePoint(size, col, row); return `<rect x="${(x - 0.25) * scale}" y="${(y - 0.75) * scale}" width="${0.5 * scale}" height="${1.5 * scale}" rx="${0.25 * scale}" fill="${fill}"/>`; };
  const boards = state.boards.map(board => {
    const [bw, bh] = BOARD_SIZES[board.size], x = pad + board.x * scale, y = pad + board.y * scale, color = palette[board.color];
    const boardItems = state.items.filter(item => item.boardId === board.id);
    const holes = allHoles(board.size).map(([col, row]) => scaledSlot(board.size, col, row, color[2])).join('');
    const items = boardItems.map(item => {
      const a = accessory(item.type), [rx, ry, rw] = itemPlacement(item, board.size).rect, ix = rx * scale, iy = ry * scale, iw = a.w * scale, ih = a.h * scale;
      return item.rotation === 90 ? `<g transform="translate(${ix + rw * scale} ${iy}) rotate(90)">${art(item.type, `x="0" y="0" width="${iw}" height="${ih}"`)}</g>` : art(item.type, `x="${ix}" y="${iy}" width="${iw}" height="${ih}"`);
    }).join('');
    const pegs = boardItems.filter(item => item.type !== 'wall-mount').map(item => itemPlacement(item, board.size).holes.map(([col, row]) => scaledSlot(board.size, col, row, '#e2b33c')).join('')).join('');
    return `<g transform="translate(${x} ${y})"><rect x="-6" y="-6" width="${bw * scale + 12}" height="${bh * scale + 12}" rx="8" fill="${color[1]}"/><rect width="${bw * scale}" height="${bh * scale}" fill="${color[0]}"/>${holes}${items}${pegs}</g>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="#e9eeea"/>${boards}</svg>`;
  const image = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  image.onload = () => {
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    canvas.getContext('2d').drawImage(image, 0, 0); URL.revokeObjectURL(url);
    canvas.toBlob(blob => { if (!blob) { toast('Could not create an image'); return; } const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${state.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'skadis-layout'}.png`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); toast('Layout image downloaded'); }, 'image/png');
  };
  image.onerror = () => { URL.revokeObjectURL(url); toast('Could not create an image'); };
  image.src = url;
}
async function copyLink() {
  const link = `${location.origin}${location.pathname}#layout=${encodeURIComponent(JSON.stringify(state))}`;
  try { await navigator.clipboard.writeText(link); toast('Shareable link copied'); }
  catch { const input = document.createElement('textarea'); input.value = link; document.body.appendChild(input); input.select(); const ok = document.execCommand('copy'); input.remove(); toast(ok ? 'Shareable link copied' : 'Copying is unavailable here'); }
}

catalogList.addEventListener('click', event => { const button = event.target.closest('[data-add]'); if (button) addAccessory(button.dataset.add); });
catalogList.addEventListener('pointerdown', event => { const card = event.target.closest('.catalog-card'); if (card) startDrag(event, card.dataset.type); });
boardLayer.addEventListener('pointerdown', event => {
  const grip = event.target.closest('.board-grip');
  if (grip) { startBoardDrag(event, grip.dataset.grip); return; }
  const element = event.target.closest('.board-item');
  if (element) { const item = state.items.find(item => item.id === element.dataset.id); if (item) startDrag(event, item.type, item.id); return; }
  const wrap = event.target.closest('.board-wrap');
  if (wrap) { selectedBoardId = wrap.dataset.boardId; selectedId = null; render(); }
});
window.addEventListener('pointermove', moveDrag);
window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', () => { if (dragging) { dragging.ghost?.remove(); dragging = null; render(); } });
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => { filter = button.dataset.filter; document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('active', b === button)); renderCatalog(); }));
$('#searchInput').addEventListener('input', event => { query = event.target.value.toLowerCase().trim(); renderCatalog(); });
document.querySelectorAll('[data-size]').forEach(button => button.addEventListener('click', () => changeSize(button.dataset.size)));
document.querySelectorAll('[data-color]').forEach(button => button.addEventListener('click', () => { if (button.dataset.color !== currentBoard().color) commit(() => currentBoard().color = button.dataset.color); }));
$('#boardSelector').addEventListener('click', event => { const button = event.target.closest('[data-select-board]'); if (button) { selectedBoardId = button.dataset.selectBoard; selectedId = null; render(); } });
$('#addBoardButton').addEventListener('click', addBoard);
$('#removeBoardButton').addEventListener('click', removeBoard);
$('#projectName').addEventListener('change', event => { const name = event.target.value.trim() || 'My perfect setup'; if (name !== state.name) commit(() => state.name = name); });
$('#selectionPanel').addEventListener('click', event => { const button = event.target.closest('[data-action]'); if (button) selectedAction(button.dataset.action); });
$('#undoButton').addEventListener('click', () => { if (!undoStack.length) return; redoStack.push(snapshot()); state = undoStack.pop(); selectedId = null; save(); render(); });
$('#redoButton').addEventListener('click', () => { if (!redoStack.length) return; undoStack.push(snapshot()); state = redoStack.pop(); selectedId = null; save(); render(); });
$('#resetButton').addEventListener('click', () => { if (!state.items.length) return; commit(() => { state.items = []; selectedId = null; }); toast('Accessories cleared — use Undo to bring them back'); });
$('#downloadButton').addEventListener('click', downloadLayout);
$('#shareButton').addEventListener('click', copyLink);
const dialog = $('#helpDialog');
$('#helpButton').addEventListener('click', () => dialog.showModal());
$('#closeHelp').addEventListener('click', () => dialog.close());
$('#startPlanning').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
document.addEventListener('keydown', event => {
  if (event.target.matches('input') || dialog.open) return;
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); (event.shiftKey ? $('#redoButton') : $('#undoButton')).click(); return; }
  const arrow = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
  const grip = event.target.closest('.board-grip');
  if (grip && arrow) {
    event.preventDefault(); const board = state.boards.find(board => board.id === grip.dataset.grip), [bw, bh] = BOARD_SIZES[board.size];
    const candidate = { ...board, x: clamp(board.x + arrow[0] * (event.shiftKey ? 5 : 1), 0, WORLD_W - bw), y: clamp(board.y + arrow[1] * (event.shiftKey ? 5 : 1), 0, WORLD_H - bh) };
    const other = state.boards.find(entry => entry.id !== board.id);
    if (!other || !boardRectOverlaps(candidate, other)) { commit(() => { board.x = candidate.x; board.y = candidate.y; }); boardLayer.querySelector(`[data-grip="${board.id}"]`)?.focus(); }
    return;
  }
  if (!selectedId) return;
  if (event.key === 'Escape') { selectedId = null; render(); return; }
  if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); selectedAction('remove'); return; }
  if (arrow) { event.preventDefault(); nudgeSelected(arrow, event.shiftKey ? 3 : 1); }
});
function nudgeSelected([dx, dy], holes) {
  const item = state.items.find(item => item.id === selectedId); if (!item) return;
  const board = state.boards.find(board => board.id === item.boardId), used = usedHoles(state.items, board, item.id);
  for (let n = holes; n < 60; n++) {
    const col = item.col + dx * 2 * n, row = item.row + dy * 2 * n, issue = placementIssue(board, item.type, item.rotation, col, row, used);
    if (issue === 'edge') break;
    if (!issue) { commit(() => { item.col = col; item.row = row; }); boardLayer.querySelector(`[data-id="${CSS.escape(selectedId)}"]`)?.focus(); return; }
  }
  toast('No free holes in that direction');
}
window.addEventListener('hashchange', () => { if (location.hash.startsWith('#layout=')) { const shared = decodeState(location.hash.slice(8)); if (shared) { state = shared; selectedId = null; selectedBoardId = state.boards[0].id; undoStack = []; redoStack = []; save(); render(); toast('Shared layout opened'); } } });
renderCatalog(); render();
new ResizeObserver(fitView).observe(boardArea.parentElement);
if (!localStorage.getItem(STORAGE_KEY) && !location.hash.startsWith('#layout=')) dialog.showModal();
save();
