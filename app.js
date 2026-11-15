const ACCESSORIES = [
  { id: 'hook', name: 'Hook', group: 'small', w: 7, h: 8, detail: 'For headphones, keys & more' },
  { id: 'double-hook', name: 'Double hook', group: 'small', w: 13, h: 8, detail: 'A little extra hanging room' },
  { id: 'container', name: 'Container', group: 'storage', w: 14, h: 16, detail: 'For pens and small things' },
  { id: 'shelf', name: 'Shelf', group: 'display', w: 28, h: 8, detail: 'Keep favorites on show' },
  { id: 'basket', name: 'Mesh basket', group: 'storage', w: 24, h: 16, detail: 'An open home for essentials' },
  { id: 'clip', name: 'Clip', group: 'small', w: 7, h: 9, detail: 'Pin a note or photo' },
  { id: 'letter-holder', name: 'Letter holder', group: 'storage', w: 20, h: 17, detail: 'Tidy papers and mail' },
  { id: 'elastic', name: 'Elastic cord', group: 'display', w: 20, h: 12, detail: 'Tuck things into place' }
];
const BOARD_SIZES = { '36x56': [36, 56], '56x56': [56, 56], '76x56': [76, 56] };
const WORLD_W = 170, WORLD_H = 82;
const DEFAULT_STATE = {
  name: 'My perfect setup',
  boards: [
    { id: 'board-1', size: '56x56', color: 'white', x: 22, y: 15 },
    { id: 'board-2', size: '56x56', color: 'white', x: 85, y: 15 }
  ],
  items: [
    { id: 'sample-1', boardId: 'board-1', type: 'clip', x: 8, y: 8, rotation: 0 },
    { id: 'sample-2', boardId: 'board-1', type: 'container', x: 11, y: 30, rotation: 0 },
    { id: 'sample-3', boardId: 'board-2', type: 'hook', x: 38, y: 8, rotation: 0 },
    { id: 'sample-4', boardId: 'board-2', type: 'basket', x: 8, y: 8, rotation: 0 },
    { id: 'sample-5', boardId: 'board-2', type: 'shelf', x: 13, y: 39, rotation: 0 }
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
  try { return sanitizeState(JSON.parse(localStorage.getItem('skadis-studio-v2'))) || sanitizeState(JSON.parse(localStorage.getItem('skadis-studio-v1'))) || structuredClone(DEFAULT_STATE); }
  catch { return structuredClone(DEFAULT_STATE); }
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
  return {
    name: String(input.name || 'My perfect setup').slice(0, 60), boards,
    items: input.items.slice(0, 100).filter(item => ACCESSORIES.some(a => a.id === item.type)).map((item, i) => {
      const a = ACCESSORIES.find(a => a.id === item.type);
      const rotation = Number(item.rotation) === 90 ? 90 : 0;
      const boardIndex = Array.isArray(input.boards) ? input.boards.findIndex(board => board.id === item.boardId) : 0;
      const board = boards[Math.max(0, Math.min(boardIndex, boards.length - 1))];
      const [bw, bh] = BOARD_SIZES[board.size];
      return { id: String(item.id || `loaded-${i}`).slice(0, 80), boardId: board.id, type: a.id, x: clamp(Number(item.x) || 0, 0, bw - (rotation ? a.h : a.w)), y: clamp(Number(item.y) || 0, 0, bh - (rotation ? a.w : a.h)), rotation };
    })
  };
}
function save() {
  try { localStorage.setItem('skadis-studio-v2', JSON.stringify(state)); }
  catch { $('#saveStatus').textContent = 'Storage unavailable — download or share your layout'; }
}
function snapshot() { return structuredClone(state); }
function commit(change) {
  undoStack.push(snapshot()); if (undoStack.length > 80) undoStack.shift();
  redoStack = []; change(); save(); render();
}
function clamp(n, min, max) { return Math.min(Math.max(n, min), Math.max(min, max)); }
function accessory(type) { return ACCESSORIES.find(item => item.id === type); }
function footprint(item) { const a = accessory(item.type); return item.rotation === 90 ? [a.h, a.w] : [a.w, a.h]; }
function currentBoard() { return state.boards.find(board => board.id === selectedBoardId) || state.boards[0]; }
function boardRectOverlaps(a, b) { const aw = BOARD_SIZES[a.size][0], bw = BOARD_SIZES[b.size][0]; return a.x < b.x + bw && a.x + aw > b.x && a.y < b.y + 56 && a.y + 56 > b.y; }
function escapeHTML(str) { return String(str).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
function nextId() { return `piece-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

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
    elastic: `<circle cx="15" cy="19" r="6" fill="${white}" stroke="${dark}" stroke-width="3"/><circle cx="85" cy="19" r="6" fill="${white}" stroke="${dark}" stroke-width="3"/><circle cx="15" cy="81" r="6" fill="${white}" stroke="${dark}" stroke-width="3"/><circle cx="85" cy="81" r="6" fill="${white}" stroke="${dark}" stroke-width="3"/><path d="M15 19 85 81M85 19 15 81" fill="none" stroke="#8d9f9a" stroke-width="7" stroke-linecap="round"/><path d="M15 19 85 81M85 19 15 81" fill="none" stroke="${shade}" stroke-width="2"/>`
  };
  return start + shapes[type] + end;
}
function renderCatalog() {
  const visible = ACCESSORIES.filter(a => (filter === 'all' || a.group === filter) && `${a.name} ${a.detail}`.toLowerCase().includes(query));
  $('#catalogCount').textContent = `${visible.length} ${visible.length === 1 ? 'piece' : 'pieces'}`;
  catalogList.innerHTML = visible.length ? visible.map(a => `<div class="catalog-card" data-type="${a.id}" role="group" aria-label="${a.name}"><div class="catalog-thumb">${art(a.id)}</div><div class="catalog-info"><strong>${a.name}</strong><small>${a.detail}</small></div><button class="add-button" data-add="${a.id}" type="button" aria-label="Add ${a.name}">+</button></div>`).join('') : '<p class="catalog-empty">No pieces found. Try another search.</p>';
}
function renderBoards() {
  $('#sizeLabel').textContent = `${state.boards.length} ${state.boards.length === 1 ? 'board' : 'boards'} · drag handles to arrange`;
  boardLayer.innerHTML = state.boards.map((board, index) => {
    const [bw, bh] = BOARD_SIZES[board.size];
    const pieces = state.items.filter(item => item.boardId === board.id).map(item => {
      const a = accessory(item.type), [w, h] = footprint(item), rotated = item.rotation === 90;
      const svg = art(item.type, rotated ? `style="position:absolute;left:50%;top:50%;width:${a.w / w * 100}%;height:${a.h / h * 100}%;transform:translate(-50%,-50%) rotate(90deg)"` : '');
      return `<div class="board-item ${item.id === selectedId ? 'selected' : ''} ${dragging?.id === item.id ? 'dragging' : ''}" data-id="${escapeHTML(item.id)}" tabindex="0" role="button" aria-label="${a.name}, select and drag to move" style="left:${item.x / bw * 100}%;top:${item.y / bh * 100}%;width:${w / bw * 100}%;height:${h / bh * 100}%">${svg}</div>`;
    }).join('');
    return `<div class="board-wrap ${board.id === selectedBoardId ? 'selected-board' : ''} ${dragging?.kind === 'board' && dragging.id === board.id ? 'board-moving' : ''}" data-board-id="${board.id}" style="left:${board.x / WORLD_W * 100}%;top:${board.y / WORLD_H * 100}%;width:${bw / WORLD_W * 100}%;height:${bh / WORLD_H * 100}%"><button class="board-grip" type="button" data-grip="${board.id}" aria-label="Drag board ${index + 1} to move it"><span class="grip-dots" aria-hidden="true">⠿</span> Move board ${index + 1}</button><div class="board board-${board.color}" role="group" aria-label="Board ${index + 1}, ${bw} by ${bh} centimeters, ${board.color}"><span class="board-index">BOARD ${String(index + 1).padStart(2, '0')}</span><div class="board-items">${pieces}</div></div></div>`;
  }).join('');
}
function renderBoardSelector() {
  $('#boardSelector').innerHTML = state.boards.map((board, i) => `<button class="board-select ${board.id === selectedBoardId ? 'active' : ''}" data-select-board="${board.id}" type="button" aria-pressed="${board.id === selectedBoardId}"><strong>Board ${i + 1}</strong><small>${board.size.replace('x', ' × ')} cm · ${board.color}</small></button>`).join('');
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
  if (!item) { panel.hidden = true; selectedId = null; return; }
  const a = accessory(item.type);
  panel.hidden = false;
  panel.innerHTML = `<div class="selection-heading"><span class="mini-art">${art(a.id)}</span><span><strong>${a.name}</strong><small>Selected accessory</small></span></div><div class="selection-actions"><button data-action="rotate" type="button">↻ Rotate</button><button data-action="duplicate" type="button">⧉ Copy</button><button data-action="remove" type="button">× Remove</button></div>`;
}
function render() {
  if (!state.boards.some(board => board.id === selectedBoardId)) selectedBoardId = state.boards[0].id;
  renderBoards(); renderBoardSelector(); renderParts(); renderSelection();
  $('#projectName').value = state.name;
  document.querySelectorAll('[data-size]').forEach(button => { button.classList.toggle('active', button.dataset.size === currentBoard().size); button.setAttribute('aria-pressed', String(button.dataset.size === currentBoard().size)); });
  document.querySelectorAll('[data-color]').forEach(button => { button.classList.toggle('active', button.dataset.color === currentBoard().color); button.setAttribute('aria-pressed', String(button.dataset.color === currentBoard().color)); });
  $('#undoButton').disabled = !undoStack.length; $('#redoButton').disabled = !redoStack.length;
}
function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600); }
function overlaps(boardId, x, y, w, h) {
  return state.items.some(item => { if (item.boardId !== boardId) return false; const [iw, ih] = footprint(item); return x < item.x + iw && x + w > item.x && y < item.y + ih && y + h > item.y; });
}
function findSpace(a, board) {
  const [bw, bh] = BOARD_SIZES[board.size];
  for (let y = 4; y <= bh - a.h; y += 3) for (let x = 4; x <= bw - a.w; x += 3) if (!overlaps(board.id, x, y, a.w, a.h)) return [x, y];
  return [clamp((bw - a.w) / 2, 0, bw - a.w), clamp((bh - a.h) / 2, 0, bh - a.h)];
}
function addAccessory(type, position, boardId = selectedBoardId) {
  const a = accessory(type), board = state.boards.find(board => board.id === boardId) || currentBoard(); if (!a) return;
  const [bw, bh] = BOARD_SIZES[board.size], [x, y] = position || findSpace(a, board), id = nextId();
  commit(() => { state.items.push({ id, boardId: board.id, type, x: clamp(x, 0, bw - a.w), y: clamp(y, 0, bh - a.h), rotation: 0 }); selectedId = id; selectedBoardId = board.id; });
  toast(`${a.name} added to ${boardLabel(board.id)}`);
}
function boardLabel(id) { return `board ${state.boards.findIndex(board => board.id === id) + 1}`; }
function changeSize(size) {
  const board = currentBoard(); if (size === board.size) return;
  commit(() => {
    board.size = size;
    const [bw, bh] = BOARD_SIZES[size];
    board.x = clamp(board.x, 0, WORLD_W - bw);
    state.items.filter(item => item.boardId === board.id).forEach(item => { const [w, h] = footprint(item); item.x = clamp(item.x, 0, bw - w); item.y = clamp(item.y, 0, bh - h); });
    const other = state.boards.find(entry => entry.id !== board.id);
    if (other && boardRectOverlaps(board, other)) {
      const [ow] = BOARD_SIZES[other.size];
      const left = board.x <= other.x ? board : other, right = left === board ? other : board;
      const leftWidth = BOARD_SIZES[left.size][0], rightWidth = BOARD_SIZES[right.size][0];
      left.x = clamp(left.x, 0, WORLD_W - leftWidth - rightWidth);
      right.x = left.x + leftWidth;
    }
  });
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
  const board = state.boards.find(board => board.id === item.boardId), [bw, bh] = BOARD_SIZES[board.size];
  if (action === 'remove') { commit(() => { state.items = state.items.filter(entry => entry.id !== item.id); selectedId = null; }); toast('Accessory removed'); }
  if (action === 'duplicate') { const [w, h] = footprint(item), id = nextId(); commit(() => { state.items.push({ ...item, id, x: clamp(item.x + 3, 0, bw - w), y: clamp(item.y + 3, 0, bh - h) }); selectedId = id; }); toast('Accessory copied'); }
  if (action === 'rotate') { commit(() => { item.rotation = item.rotation === 90 ? 0 : 90; const [w, h] = footprint(item); item.x = clamp(item.x, 0, bw - w); item.y = clamp(item.y, 0, bh - h); }); }
}
function startDrag(event, type, id = null) {
  if (event.button !== 0 || event.target.closest('button')) return;
  event.preventDefault();
  const a = accessory(type), item = id ? state.items.find(entry => entry.id === id) : null;
  const [w, h] = item ? footprint(item) : [a.w, a.h], pxPerCm = boardArea.getBoundingClientRect().width / WORLD_W;
  const ghost = document.createElement('div'); ghost.className = 'drag-ghost';
  ghost.style.width = `${w * pxPerCm}px`; ghost.style.height = `${h * pxPerCm}px`;
  ghost.innerHTML = art(type, item?.rotation === 90 ? 'style="transform:rotate(90deg)"' : '');
  document.body.appendChild(ghost);
  dragging = { kind: 'piece', type, id, ghost, w, h, pxPerCm };
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
function moveDrag(event) {
  if (!dragging) return;
  if (dragging.kind === 'piece') {
    dragging.ghost.style.left = `${event.clientX - dragging.w * dragging.pxPerCm / 2}px`;
    dragging.ghost.style.top = `${event.clientY - dragging.h * dragging.pxPerCm / 2}px`;
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
  const target = state.boards.find(board => { const element = boardLayer.querySelector(`[data-board-id="${board.id}"] .board`); const rect = element?.getBoundingClientRect(); return rect && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom; });
  if (!target) { render(); return; }
  const element = boardLayer.querySelector(`[data-board-id="${target.id}"] .board`), rect = element.getBoundingClientRect();
  const [bw, bh] = BOARD_SIZES[target.size];
  const x = Math.round(clamp((event.clientX - rect.left) / rect.width * bw - drag.w / 2, 0, bw - drag.w) * 2) / 2;
  const y = Math.round(clamp((event.clientY - rect.top) / rect.height * bh - drag.h / 2, 0, bh - drag.h) * 2) / 2;
  if (drag.id) { const item = state.items.find(entry => entry.id === drag.id); if (item && (item.x !== x || item.y !== y || item.boardId !== target.id)) commit(() => { item.x = x; item.y = y; item.boardId = target.id; selectedBoardId = target.id; }); else render(); }
  else addAccessory(drag.type, [x, y], target.id);
}
function downloadLayout() {
  const scale = 10, pad = 45, W = WORLD_W * scale + pad * 2, H = WORLD_H * scale + pad * 2;
  const palette = { white: ['#fafaf8', '#e7e8e4', '#b6c0ba'], black: ['#33383b', '#252d30', '#131b1e'], wood: ['#c9a87f', '#b38c64', '#785c40'] };
  const patterns = state.boards.map((board, i) => `<pattern id="holes${i}" width="38" height="38" patternUnits="userSpaceOnUse"><rect x="7" y="3" width="6" height="18" rx="3" fill="${palette[board.color][2]}"/><rect x="25" y="22" width="6" height="18" rx="3" fill="${palette[board.color][2]}"/></pattern>`).join('');
  const boards = state.boards.map((board, i) => {
    const [bw, bh] = BOARD_SIZES[board.size], x = pad + board.x * scale, y = pad + board.y * scale, color = palette[board.color];
    const items = state.items.filter(item => item.boardId === board.id).map(item => {
      const a = accessory(item.type), ix = item.x * scale, iy = item.y * scale, iw = a.w * scale, ih = a.h * scale;
      return item.rotation === 90 ? `<g transform="translate(${ix + ih} ${iy}) rotate(90)">${art(item.type, `x="0" y="0" width="${iw}" height="${ih}"`)}</g>` : art(item.type, `x="${ix}" y="${iy}" width="${iw}" height="${ih}"`);
    }).join('');
    return `<g transform="translate(${x} ${y})"><rect x="-6" y="-6" width="${bw * scale + 12}" height="${bh * scale + 12}" rx="8" fill="${color[1]}"/><rect width="${bw * scale}" height="${bh * scale}" fill="${color[0]}"/><rect width="${bw * scale}" height="${bh * scale}" fill="url(#holes${i})"/>${items}</g>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${patterns}</defs><rect width="100%" height="100%" fill="#e9eeea"/>${boards}</svg>`;
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
  if (arrow) { event.preventDefault(); const item = state.items.find(item => item.id === selectedId); if (!item) return; const board = state.boards.find(board => board.id === item.boardId), [bw, bh] = BOARD_SIZES[board.size], [w, h] = footprint(item), step = event.shiftKey ? 5 : 1; commit(() => { item.x = clamp(item.x + arrow[0] * step, 0, bw - w); item.y = clamp(item.y + arrow[1] * step, 0, bh - h); }); boardLayer.querySelector(`[data-id="${selectedId}"]`)?.focus(); }
});
window.addEventListener('hashchange', () => { if (location.hash.startsWith('#layout=')) { const shared = decodeState(location.hash.slice(8)); if (shared) { state = shared; selectedId = null; selectedBoardId = state.boards[0].id; undoStack = []; redoStack = []; save(); render(); toast('Shared layout opened'); } } });
renderCatalog(); render(); save();
