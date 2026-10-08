import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const rendererRoot = fileURLToPath(new URL('..', import.meta.url))

test('Vite blocks private workspace files with both local and Docker bindings', async () => {
  // A sibling directory is inside the monorepo's default Vite allowlist, but
  // outside the renderer. Only synthetic data is created or requested here.
  const privateDir = await mkdtemp(path.join(path.dirname(rendererRoot), '.vite-private-test-'))
  const privateFile = path.join(privateDir, 'run-result.json')
  const marker = 'synthetic-private-run-result'
  await writeFile(privateFile, JSON.stringify({ marker }))

  try {
    for (const host of [undefined, '0.0.0.0']) {
      const server = await createServer({
        root: rendererRoot,
        configFile: path.join(rendererRoot, 'vite.config.ts'),
        logLevel: 'silent',
        // File-access checks do not need a background dependency scan at shutdown.
        optimizeDeps: { noDiscovery: true, include: [] },
        server: { port: 0, ...(host ? { host } : {}) },
      })
      try {
        await server.listen()
        assert.equal(server.config.server.host, host ?? '127.0.0.1')
        const address = server.httpServer.address()
        const base = `http://127.0.0.1:${address.port}`
        const headers = { Host: host ? 'react:3000' : '127.0.0.1:3000' }

        for (const asset of ['/', '/src/index.tsx', '/@vite/client']) {
          const response = await fetch(`${base}${asset}`, { headers })
          assert.equal(response.status, 200, `renderer asset: ${asset}`)
          await response.text()
        }

        // IP hosts are always accepted by Vite's Host-header check, so that
        // check must not substitute for restricting access to private files.
        const fsPath = `/@fs/${privateFile.replaceAll('\\', '/').replace(/^\//, '')}`
        for (const suffix of ['', '?raw', '?import']) {
          const response = await fetch(`${base}${fsPath}${suffix}`, {
            headers: { Host: '192.0.2.123:3000' },
          })
          assert.equal(response.status, 403, `private file request: ${suffix || 'plain'}`)
          assert.equal((await response.text()).includes(marker), false)
        }
      } finally {
        await server.close()
      }
    }
  } finally {
    await rm(privateDir, { recursive: true, force: true })
  }
})
