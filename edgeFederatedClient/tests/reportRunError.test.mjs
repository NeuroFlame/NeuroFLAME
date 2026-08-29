import assert from 'node:assert/strict'
import test from 'node:test'
import inMemoryStore from '../dist/inMemoryStore.js'
import { setConfig } from '../dist/config/config.js'
import reportRunError from '../dist/runCoordinator/report/reportRunError.js'
import { setStaleSessionHandler } from '../dist/auth/staleSessionHandler.js'

setConfig({
  httpUrl: 'http://central.example/graphql',
  wsUrl: 'ws://central.example/graphql',
  pathBaseDirectory: '/tmp',
  authenticationEndpoint: 'http://central.example/authenticateToken',
  hostingPort: 4001,
})

// process.exit() would kill the test runner itself if actually invoked —
// stub it to throw a recognizable sentinel instead, so exit behavior is
// observable without ending the process.
function stubProcessExit() {
  const original = process.exit
  let code
  process.exit = (exitCode) => {
    code = exitCode
    throw new Error('PROCESS_EXIT_CALLED')
  }
  return {
    restore: () => { process.exit = original },
    codeCalledWith: () => code,
  }
}

test('reportRunError exits the process when no access token is stored', async () => {
  inMemoryStore.set('accessToken', '')
  const exitStub = stubProcessExit()
  try {
    await assert.rejects(
      () => reportRunError({ runId: 'run1', errorMessage: 'boom' }),
      /PROCESS_EXIT_CALLED/,
    )
    assert.equal(exitStub.codeCalledWith(), 1)
  } finally {
    exitStub.restore()
  }
})

test('reportRunError exits the process when centralApi rejects the stored token (401)', async () => {
  inMemoryStore.set('accessToken', 'stale-token')
  const originalFetch = global.fetch
  global.fetch = async () => new Response('unauthorized', { status: 401 })
  const exitStub = stubProcessExit()

  try {
    await assert.rejects(
      () => reportRunError({ runId: 'run1', errorMessage: 'boom' }),
      /PROCESS_EXIT_CALLED/,
    )
    assert.equal(exitStub.codeCalledWith(), 1)
  } finally {
    exitStub.restore()
    global.fetch = originalFetch
  }
})

test('reportRunError exits the process when centralApi rejects the stored token (403)', async () => {
  inMemoryStore.set('accessToken', 'stale-token')
  const originalFetch = global.fetch
  global.fetch = async () => new Response('forbidden', { status: 403 })
  const exitStub = stubProcessExit()

  try {
    await assert.rejects(
      () => reportRunError({ runId: 'run1', errorMessage: 'boom' }),
      /PROCESS_EXIT_CALLED/,
    )
    assert.equal(exitStub.codeCalledWith(), 1)
  } finally {
    exitStub.restore()
    global.fetch = originalFetch
  }
})

test('reportRunError does NOT exit the process on a non-auth failure (500)', async () => {
  inMemoryStore.set('accessToken', 'valid-token')
  const originalFetch = global.fetch
  global.fetch = async () => new Response('server error', { status: 500 })
  const exitStub = stubProcessExit()

  try {
    // Still rejects — the report attempt genuinely failed — just not via
    // the stale-session exit path.
    await assert.rejects(() => reportRunError({ runId: 'run1', errorMessage: 'boom' }))
    assert.equal(exitStub.codeCalledWith(), undefined)
  } finally {
    exitStub.restore()
    global.fetch = originalFetch
  }
})

test('reportRunError succeeds normally with a valid token and a healthy response', async () => {
  inMemoryStore.set('accessToken', 'valid-token')
  const originalFetch = global.fetch
  global.fetch = async () =>
    new Response(JSON.stringify({ data: { reportRunError: true } }), { status: 200 })
  const exitStub = stubProcessExit()

  try {
    const result = await reportRunError({ runId: 'run1', errorMessage: 'boom' })
    assert.equal(result, true)
    assert.equal(exitStub.codeCalledWith(), undefined)
  } finally {
    exitStub.restore()
    global.fetch = originalFetch
  }
})

test('a custom onStaleSession handler runs instead of the default exit, and reportRunError still throws', async () => {
  inMemoryStore.set('accessToken', 'stale-token')
  const originalFetch = global.fetch
  global.fetch = async () => new Response('unauthorized', { status: 401 })
  const exitStub = stubProcessExit()

  let handlerCalledWith
  setStaleSessionHandler((reason) => {
    handlerCalledWith = reason
    // Deliberately does NOT exit — e.g. the desktop app showing a dialog
    // and letting its own process carry on.
  })

  try {
    await assert.rejects(() => reportRunError({ runId: 'run1', errorMessage: 'boom' }))
    assert.match(handlerCalledWith, /rejected the access token stored by this process/)
    // The default process.exit was never reached — the custom handler
    // fully replaced it, it wasn't run in addition to it.
    assert.equal(exitStub.codeCalledWith(), undefined)
  } finally {
    // setStaleSessionHandler is a module-level singleton — restore the
    // exit-on-stale-session behavior the earlier tests (and any real
    // caller) rely on, so this test's override doesn't leak into
    // whatever runs after it in this same process.
    setStaleSessionHandler(() => process.exit(1))
    exitStub.restore()
    global.fetch = originalFetch
  }
})
