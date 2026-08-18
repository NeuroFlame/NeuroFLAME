import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { after, before, describe, it } from 'node:test'
import mongoose from 'mongoose'

process.env.APOLLO_PORT ||= '3001'
process.env.CLIENT_FILE_SERVER_URL ||= 'http://localhost:3003'
process.env.DATABASE_URI ||= 'mongodb://localhost/test'
process.env.RESEND_API_KEY ||= 'test'
process.env.ACCESS_TOKEN_SECRET ||= 'test'
process.env.ACCESS_TOKEN_DURATION ||= '1h'
process.env.CONSORTIUM_INVITE_URL ||= 'http://localhost/invite'

const integrationUri = process.env.MCP_MONGO_INTEGRATION_URI
const { NeuroflameOAuthProvider } = await import('../dist/mcp/oauthProvider.js')
const { setMcpEnabled, setMcpResultsEnabled } = await import('../dist/mcp/settings.js')
const { requestDesktopResult } = await import('../dist/mcp/resultRelay.js')
const { buildInviteWriteApproval } = await import('../dist/mcp/inviteApproval.js')
const { default: Consortium } = await import('../dist/database/models/Consortium.js')
const { default: Invite } = await import('../dist/database/models/Invite.js')
const { default: McpGrant } = await import('../dist/database/models/McpGrant.js')
const { default: Run } = await import('../dist/database/models/Run.js')
const { default: User } = await import('../dist/database/models/User.js')

const hashToken = (value) => createHash('sha256').update(value).digest('hex')
const client = {
  client_id: 'mongo-integration-client',
  client_id_issued_at: 1,
  client_name: 'Mongo integration client',
  redirect_uris: ['http://127.0.0.1/callback'],
  token_endpoint_auth_method: 'none',
  grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

const createGrant = async ({ user, refreshToken, scopes }) => {
  const now = Date.now()
  const familyId = randomUUID()
  await McpGrant.create({
    userId: user._id,
    familyId,
    clientId: client.client_id,
    clientName: client.client_name,
    accessTokenHash: hashToken(`access-${randomUUID()}`),
    refreshTokenHash: hashToken(refreshToken),
    spentRefreshTokenHashes: [],
    refreshRotationCount: 0,
    scopes,
    resource: 'http://localhost:3001/mcp',
    authorizationEpoch: user.mcpAuthorizationEpoch,
    accessExpiresAt: new Date(now + 60_000),
    refreshExpiresAt: new Date(now + 60_000),
    familyExpiresAt: new Date(now + 60_000),
  })
  return familyId
}

describe('MCP Mongo authorization invariants', { skip: !integrationUri }, () => {
  before(async () => {
    await mongoose.connect(integrationUri)
    if (!mongoose.connection.db?.databaseName.startsWith('neuroflame_mcp_test_')) {
      throw new Error('MCP_MONGO_INTEGRATION_URI must use a dedicated neuroflame_mcp_test_ database')
    }
    await mongoose.connection.db.dropDatabase()
  })

  after(async () => {
    await mongoose.connection.db?.dropDatabase()
    await mongoose.disconnect()
  })

  it('revokes a family when a spent refresh token is replayed', async () => {
    const user = await User.create({
      username: `mcp-${randomUUID()}@example.test`,
      hash: 'unused',
      roles: ['user'],
      mcpEnabled: true,
      mcpResultsEnabled: true,
      mcpAuthorizationEpoch: 2,
    })
    const originalRefreshToken = 'original-refresh-token'
    const now = Date.now()
    await McpGrant.create({
      userId: user._id,
      familyId: randomUUID(),
      clientId: client.client_id,
      clientName: client.client_name,
      accessTokenHash: hashToken('original-access-token'),
      refreshTokenHash: hashToken(originalRefreshToken),
      spentRefreshTokenHashes: [],
      refreshRotationCount: 0,
      scopes: ['neuroflame:read', 'neuroflame:results'],
      resource: 'http://localhost:3001/mcp',
      authorizationEpoch: 2,
      accessExpiresAt: new Date(now + 60_000),
      refreshExpiresAt: new Date(now + 60_000),
      familyExpiresAt: new Date(now + 60_000),
    })

    const provider = new NeuroflameOAuthProvider()
    const attackerTokens = await provider.exchangeRefreshToken(client, originalRefreshToken)
    await assert.rejects(
      provider.exchangeRefreshToken(client, originalRefreshToken),
      /Invalid refresh token/,
    )
    const family = await McpGrant.findOne({ clientId: client.client_id }).lean()
    assert.ok(family?.revokedAt)
    await assert.rejects(provider.verifyAccessToken(attackerTokens.access_token))
    await assert.rejects(
      provider.exchangeRefreshToken(client, attackerTokens.refresh_token),
    )
  })

  it('cannot restore result access through a concurrent disable race', async () => {
    const user = await User.create({
      username: `settings-${randomUUID()}@example.test`,
      hash: 'unused',
      roles: ['user'],
      mcpEnabled: true,
      mcpResultsEnabled: false,
    })
    await Promise.allSettled([
      setMcpResultsEnabled(user._id.toString(), true),
      setMcpEnabled(user._id.toString(), false),
    ])
    await setMcpEnabled(user._id.toString(), true)
    const current = await User.findById(user._id).lean()
    assert.equal(current?.mcpResultsEnabled, false)
  })

  it('builds distinguishable invitation approvals without raw invite tokens', async () => {
    const leader = await User.create({
      username: `leader-${randomUUID()}@example.test`,
      hash: 'unused',
      roles: ['user'],
    })
    const member = await User.create({
      username: `member-${randomUUID()}@example.test`,
      hash: 'unused',
      roles: ['user'],
      mcpEnabled: true,
      mcpAuthorizationEpoch: 0,
    })
    const consortia = await Consortium.create([
      { title: 'First consortium', leader: leader._id, members: [leader._id], studyConfiguration: {} },
      { title: 'Second consortium', leader: leader._id, members: [leader._id], studyConfiguration: {} },
    ])
    const tokens = [`invite-${randomUUID()}`, `invite-${randomUUID()}`]
    await Invite.create(tokens.map((token, index) => ({
      leader: leader._id,
      consortium: consortia[index]._id,
      token,
      email: member.username,
    })))
    const approvals = await Promise.all(tokens.map((token) =>
      buildInviteWriteApproval(member._id.toString(), token)))
    assert.notDeepEqual(approvals[0], approvals[1])
    const displayed = JSON.stringify(approvals)
    for (const token of tokens) {
      assert.doesNotMatch(displayed, new RegExp(token))
    }
  })

  it('cancels pending results when refresh removes their scope', async () => {
    const user = await User.create({
      username: `scope-${randomUUID()}@example.test`,
      hash: 'unused',
      roles: ['user'],
      mcpEnabled: true,
      mcpResultsEnabled: true,
      mcpAuthorizationEpoch: 0,
    })
    const resultRefresh = `result-${randomUUID()}`
    const resultFamily = await createGrant({
      user,
      refreshToken: resultRefresh,
      scopes: ['neuroflame:read', 'neuroflame:results'],
    })
    const run = await Run.create({
      consortium: new mongoose.Types.ObjectId(),
      consortiumLeader: user._id,
      studyConfiguration: {},
      members: [user._id],
      vaultMembers: [],
    })
    const pendingResult = requestDesktopResult({
      userId: user._id.toString(),
      familyId: resultFamily,
      authorizationEpoch: 0,
      runId: run._id.toString(),
      operation: 'list',
    })
    await delay(20)
    await new NeuroflameOAuthProvider().exchangeRefreshToken(
      client,
      resultRefresh,
      ['neuroflame:read'],
    )
    await assert.rejects(pendingResult, /revoked/)
  })
})
