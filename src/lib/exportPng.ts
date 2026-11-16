import { BOARD_SIZES, accessory, type Layout } from './catalog'
import { artSvg } from './art'
import { allHoles, holePoint, itemPlacement } from './holes'

const PALETTE = { white: ['#fafaf8', '#e7e8e4', '#b6c0ba'], black: ['#33383b', '#252d30', '#131b1e'], wood: ['#c9a87f', '#b38c64', '#785c40'] }

export function layoutSvg(layout: Layout, scale = 10, pad = 45) {
  const extents = [
    ...layout.boards.map(board => [board.x, board.y, BOARD_SIZES[board.size][0], BOARD_SIZES[board.size][1]]),
    ...layout.items.flatMap(item => {
      const board = layout.boards.find(entry => entry.id === item.boardId)
      if (!board) return []
      const [x, y, w, h] = itemPlacement(item, board.size).rect
      return [[board.x + x, board.y + y, w, h]]
    }),
  ]
  const left = Math.min(...extents.map(([x]) => x)), top = Math.min(...extents.map(([, y]) => y))
  const right = Math.max(...extents.map(([x, , w]) => x + w)), bottom = Math.max(...extents.map(([, y, , h]) => y + h))
  const W = (right - left) * scale + pad * 2, H = (bottom - top) * scale + pad * 2
  const slot = (size: Parameters<typeof holePoint>[0], col: number, row: number, fill: string) => {
    const [x, y] = holePoint(size, col, row)
    return `<rect x="${(x - 0.25) * scale}" y="${(y - 0.75) * scale}" width="${0.5 * scale}" height="${1.5 * scale}" rx="${0.25 * scale}" fill="${fill}"/>`
  }
  const boards = layout.boards.map(board => {
    const [bw, bh] = BOARD_SIZES[board.size], color = PALETTE[board.color]
    const boardItems = layout.items.filter(item => item.boardId === board.id)
    const holes = allHoles(board.size).map(([col, row]) => slot(board.size, col, row, color[2])).join('')
    const items = boardItems.map(item => {
      const a = accessory(item.type)!, [rx, ry, rw] = itemPlacement(item, board.size).rect
      const ix = rx * scale, iy = ry * scale, iw = a.w * scale, ih = a.h * scale
      return item.rotation === 90
        ? `<g transform="translate(${ix + rw * scale} ${iy}) rotate(90)">${artSvg(item.type, `x="0" y="0" width="${iw}" height="${ih}"`)}</g>`
        : artSvg(item.type, `x="${ix}" y="${iy}" width="${iw}" height="${ih}"`)
    }).join('')
    return `<g transform="translate(${pad + (board.x - left) * scale} ${pad + (board.y - top) * scale})"><rect x="-6" y="-6" width="${bw * scale + 12}" height="${bh * scale + 12}" rx="8" fill="${color[1]}"/><rect width="${bw * scale}" height="${bh * scale}" fill="${color[0]}"/>${holes}${items}</g>`
  }).join('')
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="#ffffff"/>${boards}</svg>`, width: W, height: H }
}

export function fileName(layout: Layout) {
  return `${layout.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'skadis-layout'}.png`
}

/** Renders the layout to a PNG and starts a download. Resolves false if the browser can't rasterize it. */
export function downloadPng(layout: Layout): Promise<boolean> {
  const { svg, width, height } = layoutSvg(layout)
  return new Promise(resolve => {
    const image = new Image()
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      canvas.getContext('2d')!.drawImage(image, 0, 0)
      URL.revokeObjectURL(url)
      canvas.toBlob(blob => {
        if (!blob) { resolve(false); return }
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = fileName(layout)
        link.click()
        setTimeout(() => URL.revokeObjectURL(link.href), 1000)
        resolve(true)
      }, 'image/png')
    }
    image.onerror = () => { URL.revokeObjectURL(url); resolve(false) }
    image.src = url
  })
}
