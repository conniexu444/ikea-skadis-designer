import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type RefObject } from 'react'
import { accessory, plural } from '../lib/catalog'
import { areaSelection } from '../lib/layout'
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

const MOD = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+'

export function Stage({ planner, camera, viewportRef, drag, startPieceDrag, startBoardDrag }: Props) {
  const { layout, selectedItem } = planner
  const pan = useRef<{ id: number; x: number; y: number } | null>(null)
  const [panning, setPanning] = useState(false)
  const [spaceHeld, setSpaceHeld] = useState(false)
  /** Selection box corners, in px relative to the viewport. */
  const [box, setBox] = useState<{ id: number; x0: number; y0: number; x1: number; y1: number } | null>(null)

  useEffect(() => {
    const typing = (event: KeyboardEvent) => (event.target as Element).matches('input, textarea, button, [role="button"]')
    const down = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || typing(event)) return
      event.preventDefault()
      setSpaceHeld(true)
    }
    const up = (event: KeyboardEvent) => { if (event.code === 'Space') setSpaceHeld(false) }
    const blur = () => setSpaceHeld(false)
    document.addEventListener('keydown', down)
    document.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      document.removeEventListener('keydown', down)
      document.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

  function viewportPoint(event: PointerEvent) {
    const rect = viewportRef.current!.getBoundingClientRect()
    return [event.clientX - rect.left, event.clientY - rect.top]
  }
  function onPointerDownCapture(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 1 && !(event.button === 0 && spaceHeld)) return
    event.preventDefault()
    event.stopPropagation()
    pan.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
    setPanning(true)
  }
  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || (event.target as Element).closest('.board-wrap')) return
    planner.clearSelection()
    const [x0, y0] = viewportPoint(event)
    setBox({ id: event.pointerId, x0, y0, x1: x0, y1: y0 })
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function onPointerMove(event: PointerEvent) {
    const current = pan.current
    if (current?.id === event.pointerId) {
      camera.panBy(event.clientX - current.x, event.clientY - current.y)
      pan.current = { ...current, x: event.clientX, y: event.clientY }
      return
    }
    if (box?.id === event.pointerId) {
      const [x1, y1] = viewportPoint(event)
      setBox({ ...box, x1, y1 })
    }
  }
  function onPointerUp(event: PointerEvent) {
    if (pan.current?.id === event.pointerId) { pan.current = null; setPanning(false) }
    if (box?.id === event.pointerId) {
      setBox(null)
      if (Math.abs(box.x1 - box.x0) < 4 && Math.abs(box.y1 - box.y0) < 4) return
      const { scale, x, y } = camera.camera, toCm = (px: number, offset: number) => (px - offset) / scale
      planner.selectArea(areaSelection(
        layout,
        toCm(Math.min(box.x0, box.x1), x), toCm(Math.min(box.y0, box.y1), y),
        toCm(Math.max(box.x0, box.x1), x), toCm(Math.max(box.y0, box.y1), y),
      ))
    }
  }

  const { scale, x, y } = camera.camera
  const selected = selectedItem ? accessory(selectedItem.type)! : null
  const group = planner.groupSelection
  const groupLabel = group && [
    group.boardIds.length ? plural(group.boardIds.length, 'board') : '',
    group.itemIds.length ? `${group.itemIds.length} ${group.itemIds.length === 1 ? 'accessory' : 'accessories'}` : '',
  ].filter(Boolean).join(', ')
  return (
    <section className="stage" aria-label="Board arrangement">
      <div className="stage-bar">
        <button type="button" className="text-button" onClick={planner.clearItems}>Clear accessories</button>
      </div>
      <div
        ref={viewportRef} className={`board-scroll ${panning ? 'panning' : spaceHeld ? 'pan-ready' : ''}`}
        onPointerDownCapture={onPointerDownCapture} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
      >
        {camera.ready && (
          <div className="board-area" role="group" aria-label="Boards" style={{ left: x, top: y, '--cm': `${scale}px` } as CSSProperties}>
            {layout.boards.map((board, index) => (
              <BoardView
                key={board.id} board={board} index={index}
                items={layout.items.filter(item => item.boardId === board.id)}
                selected={planner.highlightedBoardIds.has(board.id)} selectedIds={planner.selectedItemIds} drag={drag}
                onGripDown={startBoardDrag}
                onItemDown={(event, item) => startPieceDrag(event, item.type, item.id)}
              />
            ))}
          </div>
        )}
        {box && (
          <div
            className="selection-box" aria-hidden="true"
            style={{ left: Math.min(box.x0, box.x1), top: Math.min(box.y0, box.y1), width: Math.abs(box.x1 - box.x0), height: Math.abs(box.y1 - box.y0) }}
          />
        )}
      </div>
      {group && (
        <div className="selection-bar" role="toolbar" aria-label="Selection">
          <span className="selection-name"><strong>{groupLabel}</strong><small>Drag any of them to move together</small></span>
          <span className="selection-actions">
            <button type="button" onClick={planner.duplicateGroup}>⧉ Copy</button>
            <button type="button" data-action="remove" onClick={planner.removeGroup}>× Remove</button>
          </span>
        </div>
      )}
      {selected && (
        <div className="selection-bar" role="toolbar" aria-label="Selected piece">
          <span className="mini-art"><Art type={selected.id} /></span>
          <span className="selection-name"><strong>{selected.name}</strong></span>
          <span className="selection-actions">
            <button type="button" onClick={planner.rotateSelected}>↻ Rotate</button>
            <button type="button" onClick={planner.duplicateSelected}>⧉ Copy</button>
            <button type="button" data-action="remove" onClick={planner.removeSelected}>× Remove</button>
          </span>
        </div>
      )}
      <div className="stage-hints" aria-hidden="true">
        <span><b>Pinch</b> to zoom</span>
        <span><b>Drag</b> the canvas to select an area</span>
        <span><b>Scroll</b> or <kbd>Space</kbd> + drag to pan</span>
        <span><kbd>←</kbd><kbd>→</kbd> move by a hole</span>
        <span><kbd>Del</kbd> remove</span>
        <span><kbd>{MOD}C</kbd><kbd>{MOD}V</kbd> copy, paste</span>
      </div>
    </section>
  )
}
