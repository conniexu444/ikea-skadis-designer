# SKÅDIS Studio

An unofficial, browser-based planner for arranging two IKEA SKÅDIS pegboards and their accessories.

## What it does

- Drag either board by its **Move board** handle. Boards snap edge-to-edge when brought close together.
- Choose each board's size (36 × 56, 56 × 56, or 76 × 56 cm) and color independently.
- Drag accessories onto either board, move them between boards, or use the **+** buttons to add them.
- Rotate, duplicate, remove, and nudge accessories; use Undo and Redo while editing.
- Save layouts automatically in the browser, copy a layout link, and download a PNG.

## Run locally

This is a static site with no build step. Serve the three files in this repository together:

```sh
python3 -m http.server 4173
```

Open `http://localhost:4173`.

Accessory drawings and spacing are approximate planning aids. Check IKEA's product dimensions and mounting instructions before purchasing. This project is not affiliated with IKEA.
