import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { BOARD_SIZES, clamp, type Board } from '../lib/catalog'

/** `scale` is px per cm; `x`/`y` place the world origin inside the viewport, in px. */
export interface Camera { scale: number; x: number; y: number }

const MIN_SCALE = 2, MAX_SCALE = 48, MAX_FIT_SCALE = 16
const PAD_X = 32, PAD_TOP = 52, PAD_BOTTOM = 72

function fitCamera(boards: Board[], width: number, height: number): Camera {
  const left = Math.min(...boards.map(board => board.x)), right = Math.max(...boards.map(board => board.x + BOARD_SIZES[board.size][0]))
  const top = Math.min(...boards.map(board => board.y)), bottom = Math.max(...boards.map(board => board.y + BOARD_SIZES[board.size][1]))
  const scale = clamp(Math.min((width - PAD_X * 2) / (right - left), (height - PAD_TOP - PAD_BOTTOM) / (bottom - top)), MIN_SCALE, MAX_FIT_SCALE)
  return {
    scale,
    x: (width - (right - left) * scale) / 2 - left * scale,
    y: PAD_TOP + (height - PAD_TOP - PAD_BOTTOM - (bottom - top) * scale) / 2 - top * scale,
  }
}

/**
 * Zoom and pan for the board viewport. The view fits the boards until the user zooms or pans,
 * then stays where they put it.
 *
 * Trackpad pinches arrive as ctrl+wheel (Chrome, Firefox, Edge) or gesture events (Safari):
 * pinching in zooms out and spreading zooms in, around the cursor. Plain wheel/two-finger scroll pans.
 */
export function useCamera(viewportRef: RefObject<HTMLElement | null>, boards: Board[]) {
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [manual, setManual] = useState<Camera | null>(null)
  const fit = fitCamera(boards, size.width, size.height)
  const camera = manual ?? fit
  const cameraRef = useRef(camera)
  useLayoutEffect(() => { cameraRef.current = camera })

  const set = (next: Camera) => { cameraRef.current = next; setManual(next) }
  const zoomAt = (px: number, py: number, factor: number) => {
    const current = cameraRef.current, scale = clamp(current.scale * factor, MIN_SCALE, MAX_SCALE)
    set({ scale, x: px - (px - current.x) * scale / current.scale, y: py - (py - current.y) * scale / current.scale })
  }
  const panBy = (dx: number, dy: number) => { const current = cameraRef.current; set({ ...current, x: current.x + dx, y: current.y + dy }) }
  const actions = useRef({ zoomAt, panBy })
  useLayoutEffect(() => { actions.current = { zoomAt, panBy } })

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const observer = new ResizeObserver(() => setSize({ width: viewport.clientWidth, height: viewport.clientHeight }))
    observer.observe(viewport)
    const local = (event: { clientX: number; clientY: number }) => {
      const rect = viewport.getBoundingClientRect()
      return [event.clientX - rect.left, event.clientY - rect.top] as const
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const unit = event.deltaMode === 1 ? 16 : 1
      if (event.ctrlKey || event.metaKey) actions.current.zoomAt(...local(event), Math.exp(-event.deltaY * unit * 0.01))
      else actions.current.panBy(-event.deltaX * unit, -event.deltaY * unit)
    }
    // Safari's GestureEvent isn't in the DOM typings.
    type GestureEvent = Event & { scale: number; clientX: number; clientY: number }
    let gesture: { scale: number; x: number; y: number } | null = null
    const onGestureStart = (event: Event) => {
      event.preventDefault()
      const [x, y] = local(event as GestureEvent)
      gesture = { scale: cameraRef.current.scale, x, y }
    }
    const onGestureChange = (event: Event) => {
      event.preventDefault()
      if (gesture) actions.current.zoomAt(gesture.x, gesture.y, gesture.scale * (event as GestureEvent).scale / cameraRef.current.scale)
    }
    const onGestureEnd = (event: Event) => { event.preventDefault(); gesture = null }
    viewport.addEventListener('wheel', onWheel, { passive: false })
    viewport.addEventListener('gesturestart', onGestureStart)
    viewport.addEventListener('gesturechange', onGestureChange)
    viewport.addEventListener('gestureend', onGestureEnd)
    return () => {
      observer.disconnect()
      viewport.removeEventListener('wheel', onWheel)
      viewport.removeEventListener('gesturestart', onGestureStart)
      viewport.removeEventListener('gesturechange', onGestureChange)
      viewport.removeEventListener('gestureend', onGestureEnd)
    }
  }, [viewportRef])

  return {
    camera,
    ready: size.width > 0,
    panBy,
  }
}
