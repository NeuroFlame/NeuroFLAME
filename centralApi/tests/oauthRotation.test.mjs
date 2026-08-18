import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

process.env.APOLLO_PORT ||= '3001'
process.env.CLIENT_FILE_SERVER_URL ||= 'http://localhost:3003'
process.env.DATABASE_URI ||= 'mongodb://localhost/test'
process.env.RESEND_API_KEY ||= 'test'
process.env.ACCESS_TOKEN_SECRET ||= 'test'
process.env.ACCESS_TOKEN_DURATION ||= '1h'
process.env.CONSORTIUM_INVITE_URL ||= 'http://localhost/invite'

const {
  authorizationCspForRedirect,
  NeuroflameOAuthProvider,
} = await import('../dist/mcp/oauthProvider.js')
const { default: McpGrant } = await import('../dist/database/models/McpGrant.js')
const { default: User } = await import('../dist/database/models/User.js')

const client = {
  client_id: 'client-id',
  client_id_issued_at: 1,
  client_name: 'Test client',
  redirect_uris: ['http://127.0.0.1/callback'],
  token_endpoint_auth_method: 'none',
  grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
}

const grant = {
  _id: 'grant-id',
  userId: 'user-id',
  familyId: 'family-id',
  clientId: client.client_id,
  clientName: client.client_name,
  scopes: ['neuroflame:read'],
  resource: 'http://localhost:3001/mcp',
  authorizationEpoch: 4,
  refreshExpiresAt: new Date(Date.now() + 60_000),
  familyExpiresAt: new Date(Date.now() + 60_000),
}

const queryFor = (value) => {
  const promise = Promise.resolve(value)
  return {
    lean: () => promise,
    then: promise.then.bind(promise),
  }
}

describe('MCP OAuth authorization response', () => {
  it('allows only NeuroFLAME and the registered callback origin to receive the form', () => {
    const csp = authorizationCspForRedirect('http://127.0.0.1:64303/callback/random')
    assert.match(csp, /form-action 'self' http:\/\/127\.0\.0\.1:64303/)
    assert.doesNotMatch(csp, /callback\/random/)
    assert.doesNotMatch(csp, /\*/)
  })

  it('rejects callback schemes that cannot be represented safely in the policy', () => {
    assert.throws(
      () => authorizationCspForRedirect('javascript:alert(1)'),
      /must use HTTP\(S\)/,
    )
  })
})

async function withModelStubs(stubs, run) {
  const originals = []
  for (const [model, methods] of stubs) {
    for (const [name, implementation] of Object.entries(methods)) {
      originals.push([model, name, model[name]])
      model[name] = implementation
    }
  }
  try {
    return await run()
  } finally {
    for (const [model, name, implementation] of originals) model[name] = implementation
  }
}

describe('MCP refresh-token rotation', () => {
  it('allows exactly one concurrent rotation of a refresh token', async () => {
    let rotated = false
    let rotationAttempts = 0
    await withModelStubs([
      [McpGrant, {
        findOne: async () => grant,
        findOneAndUpdate: async (query) => {
          if (query.spentRefreshTokenHashes) return grant
          rotationAttempts += 1
          if (rotated) return null
          rotated = true
          return grant
        },
      }],
      [User, {
        findById: () => ({
          select: () => queryFor({ mcpEnabled: true, mcpAuthorizationEpoch: 4 }),
        }),
      }],
    ], async () => {
      const provider = new NeuroflameOAuthProvider()
      const results = await Promise.allSettled([
        provider.exchangeRefreshToken(client, 'same-refresh-token'),
        provider.exchangeRefreshToken(client, 'same-refresh-token'),
      ])
      assert.equal(results.filter(({ status }) => status === 'fulfilled').length, 1)
      assert.equal(results.filter(({ status }) => status === 'rejected').length, 1)
      assert.equal(rotationAttempts, 2)
    })
  })

  it('revokes and rejects a token rotated across an authorization epoch change', async () => {
    let userRead = 0
    let revoked = false
    await withModelStubs([
      [McpGrant, {
        findOne: async () => grant,
        findOneAndUpdate: async () => grant,
        updateOne: async () => {
          revoked = true
          return { modifiedCount: 1 }
        },
      }],
      [User, {
        findById: () => ({
          select: () => {
            userRead += 1
            return queryFor({
              mcpEnabled: true,
              mcpAuthorizationEpoch: userRead === 1 ? 4 : 5,
            })
          },
        }),
      }],
    ], async () => {
      const provider = new NeuroflameOAuthProvider()
      await assert.rejects(
        provider.exchangeRefreshToken(client, 'refresh-token'),
        /authorization has expired/,
      )
      assert.equal(revoked, true)
    })
  })
})
