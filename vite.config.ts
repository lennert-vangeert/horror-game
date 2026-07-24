import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Standard Vite + React setup. index.html at root points at /src/main.tsx.
// `public/` is served verbatim (models, audio, textures).
export default defineConfig({
  plugins: [react()],
  server: { host: true },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      output: {
        // Split the heavy three.js/r3f payload out of the app chunk.
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei'],
        },
      },
    },
  },
})
