import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// A relative base lets the built site be served from any path, e.g. GitHub Pages.
export default defineConfig({
  base: './',
  plugins: [react()],
})
