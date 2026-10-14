import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)
const fontDirectories = ['@fontsource/inter', '@fontsource/lato'].map((font) =>
  path.join(path.dirname(require.resolve(`${font}/400.css`)), 'files'),
)

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
      // Hoisted font assets are outside the renderer; allow only their files.
      allow: [fileURLToPath(new URL('.', import.meta.url)), ...fontDirectories],
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
