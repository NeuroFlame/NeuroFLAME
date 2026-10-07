import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

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
    // Docker opts into network access with --host; local development stays private.
    host: '127.0.0.1',
    open: false,
    // Vite 6 blocks unknown Host headers (403). CI Electron loads http://react:3000.
    allowedHosts: ['react'],
    fs: {
      strict: true,
      // The workspace root also contains private run files and local configuration.
      allow: [fileURLToPath(new URL('.', import.meta.url))],
    },
  },
  preview: {
    port: 3000,
    strictPort: true,
    host: '127.0.0.1',
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
