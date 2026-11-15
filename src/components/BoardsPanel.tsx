import { BOARD_SIZES, FINISHES, type BoardSize } from '../lib/catalog'
import { holeStats } from '../lib/holes'
import { MAX_BOARDS } from '../lib/layout'
import type { Planner } from '../hooks/usePlanner'

const SIZE_GRAPHIC: Record<BoardSize, string> = { '36x56': 'narrow', '56x56': 'square', '76x56': 'wide' }
const label = (text: string) => text[0].toUpperCase() + text.slice(1)

export function BoardsPanel({ planner }: { planner: Planner }) {
  const { layout, selectedBoardId, currentBoard } = planner
  return (
    <section className="panel boards-panel">
      <div className="panel-head">
        <h2>Boards</h2>
        <div className="board-actions">
          <button type="button" className="text-button" disabled={layout.boards.length >= MAX_BOARDS} onClick={planner.addBoard}>+ Add</button>
          <button type="button" className="text-button muted" disabled={layout.boards.length <= 1} onClick={planner.removeBoard}>Remove</button>
        </div>
      </div>
      <div className="board-selector" role="group" aria-label="Choose a board">
        {layout.boards.map((board, i) => {
          const { used, total } = holeStats(layout.items, board), active = board.id === selectedBoardId
          return (
            <button key={board.id} className={`board-select ${active ? 'active' : ''}`} type="button" aria-pressed={active} onClick={() => planner.selectBoard(board.id)}>
              <strong>Board {i + 1}</strong>
              <small>{board.size.replace('x', ' × ')} cm · {board.color}</small>
              <span className="meter" aria-hidden="true"><i style={{ width: `${used / total * 100}%` }} /></span>
              <small>{used} / {total} holes used</small>
            </button>
          )
        })}
      </div>
      <div className="field">
        <span className="field-label">Size <small>cm</small></span>
        <div className="segmented" role="group" aria-label="Selected board size">
          {(Object.keys(BOARD_SIZES) as BoardSize[]).map(size => (
            <button key={size} className={`size-choice ${size === currentBoard.size ? 'active' : ''}`} type="button" aria-pressed={size === currentBoard.size} onClick={() => planner.changeSize(size)}>
              <span className={`size-graphic ${SIZE_GRAPHIC[size]}`} aria-hidden="true" />{size.replace('x', ' × ')}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span className="field-label">Finish</span>
        <div className="segmented" role="group" aria-label="Selected board finish">
          {FINISHES.map(color => (
            <button key={color} className={`color-choice ${color === currentBoard.color ? 'active' : ''}`} type="button" aria-pressed={color === currentBoard.color} onClick={() => planner.changeColor(color)}>
              <span className={`swatch ${color}`} aria-hidden="true" />{label(color)}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
