import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

const { httpServerContext } = await import('../dist/api/serverContexts.js')

describe('edge local session teardown', () => {
  it('allows only the local disconnect mutation without upstream token validation', async () => {
    const context = await httpServerContext({
      req: {
        headers: { 'x-access-token': 'still-valid-active-token' },
        body: { query: 'mutation DisconnectAsUser { disconnectAsUser }' },
      },
      res: {},
    })
    assert.equal(context.accessToken, 'still-valid-active-token')
    assert.equal(context.tokenPayload, undefined)
  })

  it('does not let a combined operation bypass normal upstream validation', async () => {
    await assert.rejects(httpServerContext({
      req: {
        headers: { 'x-access-token': 'token' },
        body: { query: 'mutation { disconnectAsUser connectAsUser }' },
      },
      res: {},
    }))
  })
})
