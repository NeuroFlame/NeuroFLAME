import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import express from 'express'

process.env.APOLLO_PORT ||= '3001'
process.env.CLIENT_FILE_SERVER_URL ||= 'http://localhost:3003'
process.env.DATABASE_URI ||= 'mongodb://localhost/test'
process.env.RESEND_API_KEY ||= 'test'
process.env.ACCESS_TOKEN_SECRET ||= 'test'
process.env.ACCESS_TOKEN_DURATION ||= '1h'
process.env.CONSORTIUM_INVITE_URL ||= 'http://localhost/invite'

const {
  callResolver,
  currentResolverContext,
  resultToolError,
  safeHostedVault,
  safeMember,
  safeRunDetails,
} = await import('../dist/mcp/server.js')
const {
  DesktopResultUnavailableError,
} = await import('../dist/mcp/resultRelay.js')
const { default: McpGrant } = await import('../dist/database/models/McpGrant.js')
const { default: Invite } = await import('../dist/database/models/Invite.js')
const { default: User } = await import('../dist/database/models/User.js')
const { default: resolvers } = await import('../dist/graphql/resolvers.js')
const { buildInviteWriteApproval } = await import('../dist/mcp/inviteApproval.js')
const { normalizeRequestedScopes } = await import('../dist/mcp/oauthProvider.js')
const {
  AuthorizationAttemptLimiter,
} = await import('../dist/mcp/authorizationRateLimit.js')
const {
  authorizeWrite,
  buildWriteConfirmationMessage,
  buildWritePreview,
  writeOperationHash,
} = await import('../dist/mcp/writeConfirmation.js')
const { McpSessionRegistry } = await import('../dist/mcp/sessionRegistry.js')
const { parseMcpTrustProxy } = await import('../dist/config.js')

describe('MCP metadata allowlists', () => {
  it('removes participant dataset mappings, paths, and status details', () => {
    const result = safeMember({
      id: 'user-id',
      username: 'participant@example.test',
      vault: {
        name: 'Vault',
        description: 'Description',
        allowedComputations: [{ id: 'computation-id', title: 'Safe', imageName: 'safe:1' }],
        datasetMappings: [{ computationId: 'computation-id', datasetKey: 'private-key' }],
      },
      vaultStatus: {
        availableDatasets: [{ key: 'private-key', path: '/private/subject-data' }],
      },
    })

    assert.deepEqual(result, {
      id: 'user-id',
      username: 'participant@example.test',
      vault: {
        name: 'Vault',
        description: 'Description',
        allowedComputations: [{ id: 'computation-id', title: 'Safe', imageName: 'safe:1' }],
      },
    })
  })

  it('removes hosted-vault dataset identifiers and server internals', () => {
    const result = safeHostedVault({
      id: 'vault-id',
      serverId: 'server-id',
      name: 'Hosted vault',
      description: 'Description',
      active: true,
      datasetKey: 'private-key',
      allowedComputations: [],
    })

    assert.deepEqual(result, {
      id: 'vault-id',
      name: 'Hosted vault',
      description: 'Description',
      active: true,
      allowedComputations: [],
    })
  })

  it('keeps shared run metadata while removing hidden resolver fields', () => {
    const serialized = JSON.stringify(safeRunDetails({
      runId: 'run-id',
      consortium: { id: 'consortium-id', title: 'Study' },
      status: 'complete',
      members: [],
      vaultMembers: [],
      studyConfiguration: {
        computationParameters: '{"shared":true}',
        computation: {
          title: 'Computation',
          imageName: 'computation:1',
          imageDownloadUrl: 'https://registry.example.test/private-token',
        },
      },
      runErrors: [{
        user: { id: 'user-id', username: 'participant@example.test' },
        message: 'Sanitized shared error',
        rawStack: '/private/subject-data',
      }],
      downloadToken: 'secret-run-kit-token',
    }))

    assert.match(serialized, /Sanitized shared error/)
    assert.doesNotMatch(serialized, /private-token|private\/subject|run-kit-token/)
  })
})

describe('MCP derivative result errors', () => {
  it('tells the user when the signed-in desktop service does not respond', () => {
    const result = resultToolError(new DesktopResultUnavailableError())
    assert.equal(result.isError, true)
    assert.match(result.content[0].text, /Open the app and sign in to the same account/)
  })

  it('does not expose unexpected relay errors', () => {
    const result = resultToolError(new Error('/private/patient/results/diagnostic.log'))
    assert.doesNotMatch(result.content[0].text, /private|patient|diagnostic/i)
    assert.match(result.content[0].text, /connection permissions/)
  })
})

describe('MCP write confirmation', () => {
  it('requires the MCP host to explicitly accept and confirm the operation', async () => {
    assert.equal(await authorizeWrite({
      sendRequest: async () => ({ action: 'accept', content: { confirm: true } }),
    }, 'Confirm?'), true)
    assert.equal(await authorizeWrite({
      sendRequest: async () => ({ action: 'accept', content: { confirm: false } }),
    }, 'Confirm?'), false)
    assert.equal(await authorizeWrite({
      sendRequest: async () => ({ action: 'decline' }),
    }, 'Confirm?'), false)
  })

  it('fails closed when the MCP host cannot handle elicitation', async () => {
    assert.equal(await authorizeWrite({
      sendRequest: () => { throw new Error('Unsupported') },
    }, 'Confirm?'), false)
  })

  it('cancels approval when the MCP request is aborted', async () => {
    let requested = false
    const controller = new AbortController()
    controller.abort()
    assert.equal(await authorizeWrite({
      signal: controller.signal,
      sendRequest: async () => {
        requested = true
        return { action: 'accept', content: { confirm: true } }
      },
    }, 'Confirm?'), false)
    assert.equal(requested, false)
  })

  it('propagates cancellation to an in-flight MCP host approval', async () => {
    const controller = new AbortController()
    let receivedSignal
    const approval = authorizeWrite({
      signal: controller.signal,
      sendRequest: async (_request, _schema, options) => {
        receivedSignal = options.signal
        return await new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
        })
      },
    }, 'Confirm?')
    controller.abort()
    assert.equal(await approval, false)
    assert.equal(receivedSignal, controller.signal)
  })

  it('binds approval to a canonical exact operation payload', () => {
    assert.equal(
      writeOperationHash('start_run', { consortiumId: 'one', nested: { b: 2, a: 1 } }),
      writeOperationHash('start_run', { nested: { a: 1, b: 2 }, consortiumId: 'one' }),
    )
    assert.notEqual(
      writeOperationHash('start_run', { consortiumId: 'one' }),
      writeOperationHash('start_run', { consortiumId: 'two' }),
    )
  })

  it('shows materially different exact values and consortium defaults', () => {
    const first = buildWritePreview('create_consortium', {
      title: 'Study', description: 'alpha', isPrivate: true,
    })
    const second = buildWritePreview('create_consortium', {
      title: 'Study', description: 'bravo', isPrivate: false,
    })
    assert.notDeepEqual(first, second)
    assert.deepEqual(first.find(({ label }) => label === 'description')?.value, 'alpha')
    assert.deepEqual(first.find(({ label }) => label === 'isPrivate')?.value, 'true')
    assert.equal(
      buildWritePreview('join_consortium_by_invite', { inviteToken: 'secret' }).length,
      0,
    )
  })

  it('distinguishes truncated same-length values with a digest', () => {
    const first = buildWritePreview('set_study_parameters', { parameters: `a${'x'.repeat(2500)}` })
    const second = buildWritePreview('set_study_parameters', { parameters: `b${'x'.repeat(2500)}` })
    assert.notEqual(first[0].value, second[0].value)
    assert.match(first[0].value, /full-value SHA-256/)
  })

  it('sends a bounded exact-operation preview without excluded secrets', () => {
    const message = buildWriteConfirmationMessage({
      toolName: 'join_consortium_by_invite',
      args: { inviteToken: 'raw-secret-token' },
      summary: 'Join Consortium One?',
      preview: [
        { label: 'consortiumTitle', value: 'Consortium One' },
        { label: 'account', value: 'member@example.test' },
      ],
    })
    assert.match(message, /Join Consortium One/)
    assert.match(message, /Exact operation fingerprint: [a-f0-9]{64}/)
    assert.match(message, /member@example\.test/)
    assert.doesNotMatch(message, /raw-secret-token/)
  })

  it('shows a distinguishable invitation target without retaining its token', async () => {
    const originalInviteFindOne = Invite.findOne
    const originalUserFindById = User.findById
    const tokens = ['first-secret-token', 'second-secret-token']
    const records = new Map(tokens.map((token, index) => [token, {
      consortium: {
        _id: { toString: () => `consortium-${index}` },
        title: `Consortium ${index}`,
        members: [],
      },
      leader: { _id: 'leader-id' },
      email: 'member@example.test',
      createdAt: new Date(),
      deleteOne: async () => {},
    }]))
    Invite.findOne = ({ token }) => {
      const query = {
        populate: () => query,
        then: (resolve, reject) => Promise.resolve(records.get(token)).then(resolve, reject),
      }
      return query
    }
    User.findById = () => ({
      select: () => ({
        lean: async () => ({ username: 'member@example.test' }),
      }),
    })
    try {
      const approvals = await Promise.all(tokens.map((token) =>
        buildInviteWriteApproval('member-id', token)))
      assert.notDeepEqual(approvals[0], approvals[1])
      assert.match(JSON.stringify(approvals[0]), /Consortium 0|consortium-0/)
      assert.match(JSON.stringify(approvals[1]), /Consortium 1|consortium-1/)
      for (const token of tokens) {
        assert.doesNotMatch(JSON.stringify(approvals), new RegExp(token))
      }
    } finally {
      Invite.findOne = originalInviteFindOne
      User.findById = originalUserFindById
    }
  })

  it('requires current write scope immediately before invoking a mutation resolver', async () => {
    const originalFindById = User.findById
    const originalGrantExists = McpGrant.exists
    let invoked = false
    let checkedScope
    resolvers.Mutation.mcpScopeProbe = async () => {
      invoked = true
      return true
    }
    User.findById = () => ({
      select: () => ({
        lean: async () => ({
          roles: ['user'],
          mcpEnabled: true,
          mcpAuthorizationEpoch: 4,
        }),
      }),
    })
    McpGrant.exists = async (query) => {
      checkedScope = query.scopes
      return null
    }
    try {
      const context = {
        userId: 'user-id',
        familyId: 'family-id',
        authorizationEpoch: 4,
        clientName: 'client',
      }
      await assert.rejects(
        callResolver('Mutation', 'mcpScopeProbe', {}, context),
        /authorization has expired/,
      )
      assert.equal(checkedScope, 'neuroflame:write')
      assert.equal(invoked, false)
      await assert.rejects(
        currentResolverContext(context, 'neuroflame:write'),
        /authorization has expired/,
      )
    } finally {
      User.findById = originalFindById
      McpGrant.exists = originalGrantExists
      delete resolvers.Mutation.mcpScopeProbe
    }
  })
})

describe('MCP session and proxy limits', () => {
  it('reserves session slots atomically and releases revoked families immediately', async () => {
    const registry = new McpSessionRegistry(10)
    const reservations = Array.from({ length: 11 }, () => registry.reserve('user', 'family'))
    assert.equal(reservations.filter(Boolean).length, 10)
    for (const [index, reservation] of reservations.filter(Boolean).entries()) {
      registry.register(reservation, `session-${index}`, {
        userId: 'user',
        clientId: 'client',
        familyId: 'family',
        scopes: ['neuroflame:read'],
        lastUsedAt: Date.now(),
        transport: { close: async () => {}, handleRequest: async () => {} },
      })
    }
    await registry.closeFamily('family')
    assert.ok(registry.reserve('user', 'new-family'))
  })

  it('accepts narrow proxy topology settings and rejects global trust', () => {
    assert.equal(parseMcpTrustProxy('1'), 1)
    assert.deepEqual(parseMcpTrustProxy('10.20.0.0/24, 127.0.0.1/32'), [
      '10.20.0.0/24', '127.0.0.1/32',
    ])
    assert.throws(() => parseMcpTrustProxy('0.0.0.0/0'))
    assert.throws(() => parseMcpTrustProxy('true'))
  })

  it('trusts forwarding only from the explicitly configured proxy network', () => {
    const configured = express()
    configured.set('trust proxy', ['127.0.0.1/32'])
    const configuredTrust = configured.get('trust proxy fn')
    assert.equal(configuredTrust('127.0.0.1', 0), true)
    assert.equal(configuredTrust('203.0.113.7', 0), false)

    const unconfigured = express()
    const defaultTrust = unconfigured.get('trust proxy fn')
    assert.equal(defaultTrust('127.0.0.1', 0), false)
  })
})

describe('MCP OAuth request boundaries', () => {
  it('defaults an omitted scope to read-only', () => {
    assert.deepEqual(normalizeRequestedScopes(), ['neuroflame:read'])
    assert.deepEqual(
      normalizeRequestedScopes(['neuroflame:write']),
      ['neuroflame:write'],
    )
    assert.throws(() => normalizeRequestedScopes(['unknown']))
  })

  it('throttles authorization attempts by account and address', () => {
    const accountLimiter = new AuthorizationAttemptLimiter()
    for (let attempt = 0; attempt < 10; attempt += 1) {
      assert.equal(accountLimiter.allow(`address-${attempt}`, 'user@example.test', 1), true)
    }
    assert.equal(accountLimiter.allow('another-address', 'user@example.test', 1), false)

    const addressLimiter = new AuthorizationAttemptLimiter()
    for (let attempt = 0; attempt < 20; attempt += 1) {
      assert.equal(addressLimiter.allow('one-address', `user-${attempt}`, 1), true)
    }
    assert.equal(addressLimiter.allow('one-address', 'last-user', 1), false)
  })
})
