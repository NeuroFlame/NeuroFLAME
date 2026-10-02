import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative paths so Electron can load the production build via file://
  base: './',
  publicDir: 'public',
  build: {
    outDir: 'build',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    strictPort: true,
    // IPv4 so Electron (localhost:3000) and Docker (react:3000) hit this process
    host: '0.0.0.0',
    open: false,
    // Vite 6 blocks unknown Host headers (403). CI Electron loads http://react:3000.
    allowedHosts: ['react'],
  },
  preview: {
    port: 3000,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: ['react'],
  },
  assetsInclude: ['**/*.wasm'],
  optimizeDeps: {
    exclude: ['h5wasm'],
  },
  worker: {
    format: 'es',
  },
})
