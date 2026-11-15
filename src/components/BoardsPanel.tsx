import { useState } from 'react'
import { BOARD_SIZES, FINISHES, type BoardSize } from '../lib/catalog'
import { MAX_BOARDS } from '../lib/layout'
import type { Planner } from '../hooks/usePlanner'

const SIZE_GRAPHIC: Record<BoardSize, string> = { '36x56': 'narrow', '56x56': 'square', '76x56': 'wide' }
const label = (text: string) => text[0].toUpperCase() + text.slice(1)
const COLLAPSED_KEY = 'pegboard-boards-collapsed'

export function BoardsPanel({ planner }: { planner: Planner }) {
  const { layout, currentBoard, highlightedBoardIds, boardHighlighted } = planner
  const [open, setOpen] = useState(() => localStorage.getItem(COLLAPSED_KEY) !== '1')
  function toggle() {
    setOpen(!open)
    try { localStorage.setItem(COLLAPSED_KEY, open ? '1' : '0') } catch { /* storage unavailable */ }
  }
  return (
    <section className={`panel boards-panel ${open ? '' : 'collapsed'}`}>
      <div className="panel-head">
        <h2>
          <button type="button" className="panel-toggle" aria-expanded={open} aria-controls="boards-panel-body" onClick={toggle}>
            <span className="chevron" aria-hidden="true" />Boards
          </button>
        </h2>
      </div>
      <div id="boards-panel-body" className="panel-collapse" inert={!open}>
      <div className="panel-body">
      <div className="board-selector" role="group" aria-label="Choose a board">
        {layout.boards.map((board, i) => {
          const active = highlightedBoardIds.has(board.id)
          return (
            <div key={board.id} className={`board-card ${active ? 'active' : ''}`}>
              <button className="board-select" type="button" aria-pressed={active} onClick={() => planner.selectBoard(board.id)}>
                <strong>Board {i + 1}</strong>
                <small>{board.size.replace('x', ' × ')} cm</small>
              </button>
              {layout.boards.length > 1 && (
                <button className="board-remove" type="button" aria-label={`Remove board ${i + 1}`} title="Remove board" onClick={() => planner.removeBoard(board.id)}>×</button>
              )}
            </div>
          )
        })}
      </div>
      <button type="button" className="button add-board" disabled={layout.boards.length >= MAX_BOARDS} onClick={planner.addBoard}>+ Add board</button>
      <fieldset className="board-settings" disabled={!boardHighlighted}>
      {!boardHighlighted && <p className="board-settings-hint">Select a board to change its size or finish.</p>}
      <div className="field">
        <span className="field-label">Size <small>cm</small></span>
        <div className="segmented" role="group" aria-label="Selected board size">
          {(Object.keys(BOARD_SIZES) as BoardSize[]).map(size => (
            <button key={size} className={`size-choice ${boardHighlighted && size === currentBoard.size ? 'active' : ''}`} type="button" aria-pressed={boardHighlighted && size === currentBoard.size} onClick={() => planner.changeSize(size)}>
              <span className={`size-graphic ${SIZE_GRAPHIC[size]}`} aria-hidden="true" />{size.replace('x', ' × ')}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span className="field-label">Finish</span>
        <div className="segmented" role="group" aria-label="Selected board finish">
          {FINISHES.map(color => (
            <button key={color} className={`color-choice ${boardHighlighted && color === currentBoard.color ? 'active' : ''}`} type="button" aria-pressed={boardHighlighted && color === currentBoard.color} onClick={() => planner.changeColor(color)}>
              <span className={`swatch ${color}`} aria-hidden="true" />{label(color)}
            </button>
          ))}
        </div>
      </div>
      </fieldset>
      </div>
      </div>
    </section>
  )
}
