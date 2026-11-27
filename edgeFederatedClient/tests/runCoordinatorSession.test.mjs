import assert from 'node:assert/strict'
import { once } from 'node:events'
import test from 'node:test'
import { WebSocketServer } from 'ws'
import { setStaleSessionHandler } from '../dist/auth/staleSessionHandler.js'
import { subscribeToCentralApi } from '../dist/runCoordinator/runCoordinator.js'

for (const rejectOn of ['connection_init', 'subscribe']) {
  test(`run-start subscription reports session rejection during ${rejectOn}`, { timeout: 5000 }, async (t) => {
    const server = new WebSocketServer({ host: '127.0.0.1', port: 0 })
    t.after(async () => {
      for (const socket of server.clients) socket.terminate()
      await new Promise((resolve) => server.close(resolve))
    })
    await once(server, 'listening')

    server.on('connection', (socket) => {
      socket.on('message', (message) => {
        const { type } = JSON.parse(message.toString())
        if (type === rejectOn) socket.close(4403, 'Forbidden')
        else if (type === 'connection_init') socket.send(JSON.stringify({ type: 'connection_ack' }))
      })
    })

    const rejected = new Promise((resolve) => setStaleSessionHandler(resolve))
    await subscribeToCentralApi({
      wsUrl: `ws://127.0.0.1:${server.address().port}/graphql`,
      accessToken: 'test-session',
    })
    assert.match(await rejected, /rejected the run-start subscription session/)
  })
}
