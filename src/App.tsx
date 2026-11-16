import { useEffect, useRef, useState } from 'react'
import { accessory } from './lib/catalog'
import { downloadPng } from './lib/exportPng'
import { HOLE_PITCH } from './lib/holes'
import { overlapsAny, sharedLayout } from './lib/layout'
import { useCamera } from './hooks/useCamera'
import { useDrag } from './hooks/useDrag'
import { useLatest } from './hooks/useLatest'
import { usePlanner } from './hooks/usePlanner'
import { AppBar } from './components/AppBar'
import { Art } from './components/Art'
import { BoardsPanel } from './components/BoardsPanel'
import { Catalog } from './components/Catalog'
import { HelpDialog } from './components/HelpDialog'
import { Stage } from './components/Stage'

const BANNER_MESSAGE = 'Made by ConnieCodes Using Devin by Cognition'

const ARROWS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }

export default function App() {
  const planner = usePlanner()
  const viewportRef = useRef<HTMLDivElement>(null)
  const camera = useCamera(viewportRef, planner.layout.boards)
  const { drag, startPieceDrag, startBoardDrag } = useDrag(planner, camera.camera.scale)
  const [helpOpen, setHelpOpen] = useState(planner.firstVisit)
  const latest = useLatest({ planner, helpOpen })

  useEffect(() => {
    const onHashChange = () => {
      const shared = sharedLayout(location.hash)
      if (shared) latest.current.planner.replace(shared)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const { planner, helpOpen } = latest.current
      const target = event.target as Element
      if (target.matches('input') || helpOpen) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) planner.redo()
        else planner.undo()
        return
      }
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey) {
        const key = event.key.toLowerCase()
        if (key === 'c' && !window.getSelection()?.toString() && planner.copySelection()) event.preventDefault()
        if (key === 'v') { event.preventDefault(); planner.paste() }
        if (key === 'c' || key === 'v') return
      }
      const arrow = ARROWS[event.key], grip = target.closest<HTMLElement>('.board-grip')
      if (grip && arrow) {
        event.preventDefault()
        const board = planner.layout.boards.find(entry => entry.id === grip.dataset.grip)!, step = event.shiftKey ? 5 : 1
        const x = board.x + arrow[0] * step, y = board.y + arrow[1] * step
        if (!overlapsAny(planner.layout.boards, { ...board, x, y })) planner.moveBoard(board.id, x, y)
        return
      }
      if (event.key === 'Escape') { planner.clearSelection(); return }
      if (planner.groupSelection) {
        if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); if (target.matches('button')) (target as HTMLElement).blur(); planner.removeGroup(); return }
        if (arrow) {
          event.preventDefault()
          const dc = arrow[0] * 2 * (event.shiftKey ? 3 : 1), dr = arrow[1] * 2 * (event.shiftKey ? 3 : 1)
          planner.moveGroup(dc * HOLE_PITCH, dr * HOLE_PITCH, dc, dr)
        }
        return
      }
      const remove = event.key === 'Delete' || event.key === 'Backspace'
      if (remove && target.matches('button')) (target as HTMLElement).blur()
      if (!planner.selectedItem) {
        if (remove && planner.boardHighlighted) { event.preventDefault(); planner.removeBoard() }
        return
      }
      if (remove) { event.preventDefault(); planner.removeSelected(); return }
      if (arrow) { event.preventDefault(); planner.nudgeSelected(arrow, event.shiftKey ? 3 : 1) }
    }
    window.addEventListener('hashchange', onHashChange)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('hashchange', onHashChange)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [latest])

  async function download() {
    await downloadPng(planner.layout)
  }

  const ghost = drag?.kind === 'piece' ? drag : null
  return (
    <>
      <div className="app">
        <AppBar
          saveFailed={planner.saveFailed} canUndo={planner.canUndo} canRedo={planner.canRedo}
          onUndo={planner.undo} onRedo={planner.redo} onDownload={download}
        />
        <div className="sponsor-banner" role="note" aria-label={BANNER_MESSAGE}>
          <div className="sponsor-track" aria-hidden="true">
            {Array.from({ length: 4 }, (_, index) => <span key={index}>{BANNER_MESSAGE}</span>)}
          </div>
        </div>
        <main className="workbench">
          <aside className="sidebar" aria-label="Boards and accessories">
            <BoardsPanel planner={planner} />
            <Catalog onAdd={type => planner.addAccessory(type)} onStartDrag={(event, type) => startPieceDrag(event, type)} />
          </aside>
          <Stage planner={planner} camera={camera} viewportRef={viewportRef} drag={drag} startPieceDrag={startPieceDrag} startBoardDrag={startBoardDrag} />
        </main>
      </div>
      {ghost && (
        <div className="drag-ghost" style={{
          width: ghost.w * ghost.pxPerCm, height: ghost.h * ghost.pxPerCm,
          left: ghost.clientX - ghost.w * ghost.pxPerCm / 2, top: ghost.clientY - ghost.h * ghost.pxPerCm / 2,
        }}>
          <Art type={accessory(ghost.type)!.id} color={planner.layout.items.find(item => item.id === ghost.id)?.color} style={ghost.rotation === 90 ? { transform: 'rotate(90deg)' } : undefined} />
        </div>
      )}
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  )
}
