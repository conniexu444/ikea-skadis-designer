# SKÅDIS Studio

An unofficial, browser-based planner for arranging two IKEA SKÅDIS pegboards and their accessories.

## What it does

- Drag either board by its **Board** handle. Boards snap edge-to-edge when brought close together.
- Choose each board's size (36 × 56, 56 × 56, or 76 × 56 cm) and color independently.
- Accessories snap onto the board's SKÅDIS hole grid (holes 2 cm apart diagonally, 4 cm apart in a row or column). On the 36 × 56 board the rows alternate 8 and 9 holes, with 8 on both the top and bottom rows. Each piece uses one or more holes, and a hole can only hold one thing.
- Place **Wall mounts** on the holes that hold each board to the wall; those holes are then unavailable for accessories.
- Drag accessories onto either board, move them between boards, or use the **+** buttons to add them. While dragging, the target holes turn blue when free and red when taken.
- Rotate, duplicate, remove, and nudge accessories; use Undo and Redo while editing.
- Pinch the trackpad over the boards to zoom (pinch in to zoom out, spread to zoom in); scroll or drag the empty wall to pan. The **%** button fits the boards back into view.
- Save layouts automatically in the browser, copy a layout link, and download a PNG.

## Run locally

The app is built with React, TypeScript and Vite. With Node.js installed:

```sh
npm install
npm run dev       # dev server at http://localhost:5173
npm test          # hole-grid and layout tests (Vitest)
npm run lint      # Oxlint
npm run build     # type-check and build the static site into dist/
```

`dist/` uses relative paths, so it can be hosted from any folder, e.g. GitHub Pages.

Accessory drawings and spacing are approximate planning aids. Check IKEA's product dimensions and mounting instructions before purchasing. This project is not affiliated with IKEA.
