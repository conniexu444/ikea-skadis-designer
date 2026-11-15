import { useRef, useState, type CSSProperties, type PointerEvent, type RefObject } from 'react'
import { accessory, plural } from '../lib/catalog'
import { holeStats } from '../lib/holes'
import { useCamera } from '../hooks/useCamera'
import type { Drag, useDrag } from '../hooks/useDrag'
import type { Planner } from '../hooks/usePlanner'
import { Art } from './Art'
import { BoardView } from './BoardView'

interface Props {
  planner: Planner
  camera: ReturnType<typeof useCamera>
  viewportRef: RefObject<HTMLDivElement | null>
  drag: Drag | null
  startPieceDrag: ReturnType<typeof useDrag>['startPieceDrag']
  startBoardDrag: ReturnType<typeof useDrag>['startBoardDrag']
}

const GRID_CM = 4

export function Stage({ planner, camera, viewportRef, drag, startPieceDrag, startBoardDrag }: Props) {
  const { layout, selectedItem } = planner
  const pan = useRef<{ id: number; x: number; y: number } | null>(null)
  const [panning, setPanning] = useState(false)
  const totals = layout.boards.reduce((sum, board) => {
    const { used, total } = holeStats(layout.items, board)
    return { used: sum.used + used, total: sum.total + total }
  }, { used: 0, total: 0 })

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || (event.target as Element).closest('.board-wrap')) return
    if (selectedItem) planner.selectItem(null)
    pan.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
    setPanning(true)
  }
  function onPointerMove(event: PointerEvent) {
    const current = pan.current
    if (current?.id !== event.pointerId) return
    camera.panBy(event.clientX - current.x, event.clientY - current.y)
    pan.current = { ...current, x: event.clientX, y: event.clientY }
  }
  function onPointerUp(event: PointerEvent) {
    if (pan.current?.id === event.pointerId) { pan.current = null; setPanning(false) }
  }

  const { scale, x, y } = camera.camera
  const selected = selectedItem ? accessory(selectedItem.type)! : null
  return (
    <section className="stage" aria-label="Board arrangement">
      <div className="stage-bar">
        <span className="stage-summary">{plural(layout.boards.length, 'board')} · {totals.used} of {totals.total} holes used</span>
        <button type="button" className="text-button" onClick={planner.clearItems}>Clear accessories</button>
      </div>
      <div
        ref={viewportRef} className={`board-scroll ${panning ? 'panning' : ''}`}
        style={{ backgroundSize: `${GRID_CM * scale}px ${GRID_CM * scale}px`, backgroundPosition: `${x}px ${y}px` }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
      >
        {camera.ready && (
          <div className="board-area" role="group" aria-label="Boards" style={{ left: x, top: y, '--cm': `${scale}px` } as CSSProperties}>
            {layout.boards.map((board, index) => (
              <BoardView
                key={board.id} board={board} index={index}
                items={layout.items.filter(item => item.boardId === board.id)}
                selected={board.id === planner.selectedBoardId} selectedId={planner.selectedId} drag={drag}
                onGripDown={startBoardDrag}
                onItemDown={(event, item) => startPieceDrag(event, item.type, item.id)}
              />
            ))}
          </div>
        )}
      </div>
      {selected && (
        <div className="selection-bar" role="toolbar" aria-label="Selected piece">
          <span className="mini-art"><Art type={selected.id} /></span>
          <span className="selection-name"><strong>{selected.name}</strong><small>Uses {plural(selected.pegs.length, 'hole')}</small></span>
          <span className="selection-actions">
            <button type="button" onClick={planner.rotateSelected}>↻ Rotate</button>
            <button type="button" onClick={planner.duplicateSelected}>⧉ Copy</button>
            <button type="button" data-action="remove" onClick={planner.removeSelected}>× Remove</button>
          </span>
        </div>
      )}
      <div className="zoom-controls" role="group" aria-label="Zoom">
        <button type="button" className="icon-button" aria-label="Zoom out" title="Zoom out (pinch in)" onClick={camera.zoomOut}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12" /></svg>
        </button>
        <button type="button" className="zoom-level" title="Fit boards to view" onClick={camera.fitToView}>{camera.zoomPercent}%</button>
        <button type="button" className="icon-button" aria-label="Zoom in" title="Zoom in (pinch out)" onClick={camera.zoomIn}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12M12 6v12" /></svg>
        </button>
      </div>
      <div className="stage-hints" aria-hidden="true">
        <span><b>Pinch</b> to zoom</span>
        <span><b>Scroll</b> or drag the canvas to pan</span>
        <span><kbd>←</kbd><kbd>→</kbd> move by a hole</span>
        <span><kbd>Del</kbd> remove</span>
      </div>
    </section>
  )
}
