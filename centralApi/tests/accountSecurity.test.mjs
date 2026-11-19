import assert from 'node:assert/strict'
import { before, beforeEach, after, test, mock } from 'node:test'
import { createHash, randomUUID } from 'node:crypto'
import mongoose from 'mongoose'
import { Resend } from 'resend'
import { ApolloServer } from '@apollo/server'
import { startStandaloneServer } from '@apollo/server/standalone'
import { makeExecutableSchema } from '@graphql-tools/schema'
import { WebSocketServer, WebSocket } from 'ws'
import { useServer } from 'graphql-ws/lib/use/ws'
import { createClient } from 'graphql-ws'
import jwt from 'jsonwebtoken'
import { setTimeout as delay } from 'node:timers/promises'

const mongoURI = process.env.MONGODB_SECURITY_TEST_URI
const integration = (name, fn) => test(name, { skip: !mongoURI, timeout: 15000 }, fn)
let User, Consortium, resolvers, httpServerContext, hashPassword, generateTokens, typeDefs, logger
let server, victim, caller, vault, admin, originalHash, mails, mailFails, errors
let backfillUserTokenVersion, createSessionWebSocketOptions, pubsub, compare, VaultServer
let installAccountRateLimits, HostedVault
const password = 'OriginalSecure!1'
const context = (user) => ({ userId: String(user._id), roles: user.roles })
const digest = (token) => createHash('sha256').update(token).digest('hex')
const tokenFromMail = () => mails.at(-1).html.match(/Token: <strong>([a-f0-9]{64})<\/strong>/)[1]
const requestReset = () => resolvers.Mutation.requestPasswordReset(null, { username: victim.username })
const reset = (token) => resolvers.Mutation.resetPassword(null, { token, newPassword: 'ReplacementSecure!1' })

before(async () => {
  if (!mongoURI) return
  Object.assign(process.env, {
    CLIENT_FILE_SERVER_URL: 'http://127.0.0.1:3998',
    APOLLO_PORT: '3999',
    DATABASE_URI: mongoURI,
    RESEND_API_KEY: 're_test',
    ACCESS_TOKEN_SECRET: 'isolated-security-test-secret',
    ACCESS_TOKEN_DURATION: '1h',
    CONSORTIUM_INVITE_URL: 'http://127.0.0.1:3999/invite',
  })
  const modules = await Promise.all([
    import('../dist/database/models/User.js'), import('../dist/database/models/Consortium.js'),
    import('../dist/graphql/resolvers.js'), import('../dist/serverContexts.js'),
    import('../dist/authentication/authentication.js'), import('../dist/graphql/generated/typeDefs.js'),
    import('../dist/logger.js'), import('../dist/database/backfillUserTokenVersion.js'),
    import('../dist/authentication/sessionWebSockets.js'), import('../dist/graphql/pubSubService.js'),
    import('../dist/database/models/VaultServer.js'),
    import('../dist/authentication/accountRateLimit.js'),
    import('../dist/database/models/HostedVault.js'),
  ])
  User = modules[0].default
  Consortium = modules[1].default
  resolvers = modules[2].default
  httpServerContext = modules[3].httpServerContext
  ;({ hashPassword, generateTokens, compare } = modules[4])
  ;({ typeDefs } = modules[5])
  ;({ logger } = modules[6])
  ;({ backfillUserTokenVersion } = modules[7])
  ;({ createSessionWebSocketOptions } = modules[8])
  pubsub = modules[9].default
  VaultServer = modules[10].default
  ;({ installAccountRateLimits } = modules[11])
  HostedVault = modules[12].default
  await mongoose.connect(mongoURI, { dbName: `account_security_${randomUUID().replaceAll('-', '')}` })
  originalHash = await hashPassword(password)
  mock.method(Resend.prototype, 'post', async (_path, payload) => {
    mails.push(payload)
    return mailFails ? { error: { message: 'sensitive provider detail' } } : { data: { id: 'stub' }, error: null }
  })
  mock.method(logger, 'error', (...args) => { errors.push(args) })
  server = new ApolloServer({ schema: makeExecutableSchema({ typeDefs, resolvers }) })
  await server.start()
})

beforeEach(async () => {
  if (!mongoURI) return
  await User.deleteMany({})
  await Consortium.deleteMany({})
  mails = []; errors = []; mailFails = false
  ;[victim, caller, vault, admin] = await User.create([
    { username: 'victim@example.test', hash: originalHash },
    { username: 'caller@example.test', hash: originalHash },
    { username: 'vault@example.test', hash: originalHash, roles: ['vault'] },
    { username: 'admin@example.test', hash: originalHash, roles: ['admin'] },
  ])
})

after(async () => {
  if (!mongoURI) return
  if (server) await server.stop()
  if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase()
  await mongoose.disconnect()
  mock.restoreAll()
})

integration('anonymous and cross-account password updates cannot mutate another user', async () => {
  const unauthenticated = await server.executeOperation({
    query: 'mutation { userChangePassword(currentPassword: "wrong", password: "Attacker!1") }',
  }, { contextValue: {} })
  assert.match(unauthenticated.body.singleResult.errors[0].message, /not authenticated/)
  const crossUser = await server.executeOperation({
    query: `mutation { userChangePassword(userId: "${victim.id}", currentPassword: "wrong", password: "Attacker!1") }`,
  }, { contextValue: context(caller) })
  assert.match(crossUser.body.singleResult.errors[0].message, /Unknown argument/)
  assert.equal((await User.findById(victim.id)).hash, originalHash)
  assert.ok(!typeDefs.includes('updateAccount'))
})

integration('reset delivery uses the stored email and persists only a token digest', async () => {
  assert.equal(await requestReset(), true)
  const token = tokenFromMail()
  const stored = await User.findById(victim.id)
  assert.equal(mails[0].to[0], victim.username)
  assert.equal(stored.resetEmail, victim.username)
  assert.equal(stored.resetToken, digest(token))
  assert.notEqual(stored.resetToken, token)
})

integration('startup backfill preserves existing versions and login tokens', async () => {
  await User.collection.updateMany({ _id: { $in: [victim._id, vault._id] } }, { $unset: { tokenVersion: '' } })
  await User.collection.updateOne({ _id: caller._id }, { $set: { tokenVersion: 7 } })
  const legacyToken = generateTokens({ userId: victim.id, roles: victim.roles }).accessToken
  const currentToken = generateTokens({ userId: caller.id, roles: caller.roles, tokenVersion: 7 }).accessToken
  const before = await User.collection.find({}).sort({ _id: 1 }).toArray()
  assert.equal(await backfillUserTokenVersion(), 2)
  assert.equal(await backfillUserTokenVersion(), 0)
  const after = await User.collection.find({}).sort({ _id: 1 }).toArray()
  assert.deepEqual(after, before.map((user) => ({ tokenVersion: 0, ...user })))
  for (const [token, user] of [[legacyToken, victim], [currentToken, caller]]) {
    const auth = await httpServerContext({ req: { headers: { 'x-access-token': token } }, res: {} })
    assert.equal(String(auth.userId), user.id)
    assert.equal(auth.error, undefined)
  }
})

integration('accounts predating tokenVersion can still request and complete a reset', async () => {
  await User.collection.updateOne({ _id: victim._id }, { $unset: { tokenVersion: '' } })
  await requestReset()
  assert.equal(mails.length, 1)
  assert.equal((await reset(tokenFromMail())).userId, victim.id)
  assert.equal((await User.findById(victim.id)).tokenVersion, 1)
})

integration('reset requests and login failures do not disclose account existence', async () => {
  assert.equal(await requestReset(), true)
  assert.equal(await resolvers.Mutation.requestPasswordReset(null, { username: 'missing@example.test' }), true)
  assert.equal(mails.length, 1)
  mailFails = true
  assert.equal(await requestReset(), true)
  assert.deepEqual(errors, [['Password reset email delivery failed']])
  for (const username of [victim.username, 'missing@example.test']) {
    await assert.rejects(resolvers.Mutation.login(null, { username, password: 'wrong' }),
      { message: 'Invalid username or password' })
  }
})

integration('reset cannot follow an account email change or target another account', async () => {
  await requestReset()
  const token = tokenFromMail()
  await User.updateOne({ _id: victim._id }, { $set: { username: 'changed@example.test' } })
  await assert.rejects(reset(token), { message: 'Invalid or expired token' })
  assert.equal((await User.findById(victim.id)).hash, originalHash)
  assert.equal((await User.findById(caller.id)).hash, originalHash)
})

integration('expired, malformed and pre-fix tokens all return the same error', async () => {
  await requestReset()
  const token = tokenFromMail()
  await User.updateOne({ _id: victim._id }, { $set: { resetTokenExpiry: new Date(0) } })
  await assert.rejects(reset(token), { message: 'Invalid or expired token' })
  await assert.rejects(reset('malformed'), { message: 'Invalid or expired token' })
  await User.updateOne({ _id: victim._id }, {
    $set: { resetToken: token, resetTokenExpiry: new Date(Date.now() + 60000) }, $unset: { resetEmail: '' },
  })
  await assert.rejects(reset(token), { message: 'Invalid or expired token' })
})

integration('reset is atomically single-use and revokes earlier sessions', async () => {
  const oldAccessToken = generateTokens({ userId: victim.id, roles: victim.roles, tokenVersion: 0 }).accessToken
  await requestReset()
  const token = tokenFromMail()
  const results = await Promise.allSettled([reset(token), reset(token)])
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1)
  const user = await User.findById(victim.id)
  assert.equal(user.tokenVersion, 1)
  for (const field of ['resetToken', 'resetTokenExpiry', 'resetEmail']) assert.equal(user[field], undefined)
  const oldContext = await httpServerContext({ req: { headers: { 'x-access-token': oldAccessToken } }, res: {} })
  assert.equal(oldContext.userId, undefined)
  assert.match(oldContext.error, /revoked/)
  const freshToken = results.find((result) => result.status === 'fulfilled').value.accessToken
  const freshContext = await httpServerContext({ req: { headers: { 'x-access-token': freshToken } }, res: {} })
  assert.equal(String(freshContext.userId), victim.id)
})

integration('new reset requests replace previous tokens', async () => {
  await requestReset()
  const first = tokenFromMail()
  await requestReset()
  const second = tokenFromMail()
  assert.notEqual(first, second)
  await assert.rejects(reset(first), { message: 'Invalid or expired token' })
  assert.equal((await reset(second)).userId, victim.id)
})

integration('self and admin password changes invalidate pending reset tokens', async () => {
  await requestReset()
  let token = tokenFromMail()
  assert.equal(await resolvers.Mutation.userChangePassword(null,
    { currentPassword: password, password: 'SelfSecure!1' }, context(victim)), true)
  await assert.rejects(reset(token), { message: 'Invalid or expired token' })
  await requestReset()
  token = tokenFromMail()
  await resolvers.Mutation.adminChangeUserPassword(null,
    { username: victim.username, password: 'AdminSecure!1' }, context(admin))
  await assert.rejects(reset(token), { message: 'Invalid or expired token' })
  assert.equal((await User.findById(victim.id)).tokenVersion, 2)
  await assert.rejects(resolvers.Mutation.adminChangeUserPassword(null,
    { username: victim.username, password: 'Attacker!1' }, context(caller)), /Unauthorized/)
})

integration('vault directory requires authentication and never returns credential fields', async () => {
  const query = '{ getVaultUserList { id username } }'
  const denied = await server.executeOperation({ query }, { contextValue: {} })
  assert.match(denied.body.singleResult.errors[0].message, /not authenticated/)
  const allowed = await resolvers.Query.getVaultUserList(null, null, context(caller))
  assert.equal(allowed.length, 1)
  assert.ok(!JSON.stringify(allowed).includes(vault.username))
  for (const field of ['hash', 'resetToken', 'resetEmail', '_id']) assert.ok(!(field in allowed[0]))
})

integration('public consortium metadata hides unrelated users while members retain assignment IDs', async () => {
  const member = await User.create({ username: 'member@example.test', hash: originalHash })
  const vaultServer = await VaultServer.create({
    user: vault._id, name: 'Private service', description: 'Internal',
  })
  const hostedVault = await HostedVault.create({
    server: vaultServer._id,
    name: 'Private dataset',
    description: 'Internal dataset',
    datasetKey: 'private-dataset-key',
  })
  const consortium = await Consortium.create({
    title: 'Public study',
    leader: victim._id,
    members: [victim._id, member._id],
    activeMembers: [victim._id],
    readyMembers: [victim._id],
    vaultMembers: [hostedVault._id],
    activeVaultMembers: [hostedVault._id],
    readyVaultMembers: [hostedVault._id],
    studyConfiguration: {
      consortiumLeaderNotes: 'Private leader notes',
      computationParameters: '{"privateParameter":true}',
      computation: {
        title: 'Internal computation',
        imageName: 'example/test',
        imageDownloadUrl: 'example/test',
        notes: 'Internal computation notes',
        owner: victim.id,
      },
    },
  })
  for (const viewer of [{}, context(caller)]) {
    const list = await resolvers.Query.getConsortiumList(null, null, viewer)
    const details = await resolvers.Query.getConsortiumDetails(null, { consortiumId: consortium.id }, viewer)
    for (const result of [list, details]) {
      assert.ok(!JSON.stringify(result).includes(victim.username))
      assert.ok(!JSON.stringify(result).includes(victim.id))
      assert.ok(JSON.stringify(result).includes('Public study'))
    }
    assert.deepEqual(list[0].members, [])
    const hiddenLists = ['members', 'activeMembers', 'readyMembers',
      'vaultMembers', 'activeVaultMembers', 'readyVaultMembers']
    for (const key of hiddenLists) {
      assert.deepEqual(details[key], [])
    }
    assert.deepEqual(details.studyConfiguration, {
      consortiumLeaderNotes: null, computationParameters: '', computation: null,
    })
  }
  for (const viewer of [context(victim), context(member), context(admin)]) {
    const list = await resolvers.Query.getConsortiumList(null, null, viewer)
    assert.equal(list[0].members[0].id, victim.id)
    assert.equal(list[0].leader.username, victim.username)
    const details = await resolvers.Query.getConsortiumDetails(null, { consortiumId: consortium.id }, viewer)
    assert.equal(details.studyConfiguration.consortiumLeaderNotes, 'Private leader notes')
    assert.equal(details.studyConfiguration.computation.owner, victim.id)
  }
  await Consortium.updateOne({ _id: consortium._id }, { $set: { isPrivate: true } })
  const serviceDetails = await resolvers.Query.getConsortiumDetails(null,
    { consortiumId: consortium.id }, context(vault))
  assert.equal(serviceDetails.studyConfiguration.computation.owner, victim.id)
  for (const viewer of [{}, context(caller)]) {
    assert.deepEqual(await resolvers.Query.getConsortiumList(null, null, viewer), [])
    await assert.rejects(resolvers.Query.getConsortiumDetails(null, { consortiumId: consortium.id }, viewer))
  }
})

integration('self password changes require the old password and revoke old tokens', async () => {
  const beforeToken = generateTokens({ userId: victim.id, roles: victim.roles, tokenVersion: 0 }).accessToken
  const missing = await server.executeOperation({ query: 'mutation { userChangePassword(password: "NewSecure!1") }' },
    { contextValue: context(victim) })
  assert.match(missing.body.singleResult.errors[0].message, /currentPassword/)
  await assert.rejects(resolvers.Mutation.userChangePassword(null,
    { currentPassword: 'wrong', password: 'NewSecure!1' }, context(victim)), /Current password is incorrect/)
  assert.equal((await User.findById(victim.id)).hash, originalHash)
  const saved = await server.executeOperation({
    query: `mutation($current: String!, $next: String!) {
      userChangePassword(currentPassword: $current, password: $next)
    }`,
    variables: { current: password, next: 'NewSecure!1' },
  }, { contextValue: context(victim) })
  assert.equal(saved.body.singleResult.data.userChangePassword, true)
  const updated = await User.findById(victim.id)
  assert.equal(updated.tokenVersion, 1)
  assert.equal(await compare('NewSecure!1', updated.hash), true)
  const stale = await httpServerContext({ req: { headers: { 'x-access-token': beforeToken } }, res: {} })
  assert.equal(stale.userId, undefined)
  assert.equal((await User.findById(caller.id)).hash, originalHash)
})

integration('concurrent password changes cannot overwrite a newer password', async () => {
  const attempts = ['FirstSecure!1', 'SecondSecure!1']
  const results = await Promise.allSettled(attempts.map((next) => resolvers.Mutation.userChangePassword(null,
    { currentPassword: password, password: next }, context(victim))))
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  const winner = results.findIndex((result) => result.status === 'fulfilled')
  const user = await User.findById(victim.id)
  assert.equal(await compare(attempts[winner], user.hash), true)
  assert.equal(user.tokenVersion, 1)
})

const wsHarness = async (t) => {
  const sockets = new WebSocketServer({ host: '127.0.0.1', port: 0 })
  await new Promise((resolve) => sockets.once('listening', resolve))
  const schema = makeExecutableSchema({ typeDefs, resolvers })
  installAccountRateLimits(schema)
  const guard = createSessionWebSocketOptions(schema)
  const readiness = new Map()
  const cleanup = useServer({ ...guard.options, onOperation: (_ctx, msg) => { readiness.get(msg.id)?.() } }, sockets)
  const clients = []
  t.after(async () => {
    for (const client of clients) await client.dispose()
    try { await cleanup.dispose() } finally { guard.dispose() }
  })
  const connect = async (token) => {
    let ack, closed
    const acknowledged = new Promise((resolve) => { ack = resolve })
    const disconnected = new Promise((resolve) => { closed = resolve })
    const frames = []
    const nextMessages = []
    const clientId = clients.length
    let operationNumber = 0
    const client = createClient({
      url: `ws://127.0.0.1:${sockets.address().port}`,
      webSocketImpl: WebSocket,
      connectionParams: { accessToken: token },
      lazy: false,
      retryAttempts: 0,
      onNonLazyError: () => {},
      generateID: () => `${clientId}-${++operationNumber}`,
      on: {
        connected: () => ack(),
        closed: (event) => closed(event),
        message: (msg) => {
          frames.push(msg)
          if (msg.type === 'next') nextMessages.shift()?.(msg)
        },
      },
    })
    clients.push(client)
    await acknowledged
    const subscribe = async (consortiumId) => {
      const ready = new Promise((resolve) => readiness.set(`${clientId}-${operationNumber + 1}`, resolve))
      client.subscribe({ query: `subscription { consortiumDetailsChanged(consortiumId: "${consortiumId}") }` },
        { next: () => {}, error: () => {}, complete: () => {} })
      await ready
      await delay(0)
    }
    return {
      client,
      frames,
      disconnected,
      subscribe,
      nextMessage: () => new Promise((resolve) => nextMessages.push(resolve)),
    }
  }
  return { connect }
}

const subscriptionFixture = async () => Consortium.create({
  title: 'Live study', leader: victim._id, members: [victim._id, caller._id], studyConfiguration: {},
})
const tokenFor = (user) => generateTokens({
  userId: user.id, roles: user.roles, tokenVersion: user.tokenVersion,
}).accessToken
const publish = (consortium) => pubsub.publish('CONSORTIUM_DETAILS_CHANGED', { consortiumId: consortium.id })

integration('self password changes disconnect only that user on established sockets', async (t) => {
  const live = await wsHarness(t)
  const consortium = await subscriptionFixture()
  const owner = await live.connect(tokenFor(victim))
  const other = await live.connect(tokenFor(caller))
  await owner.subscribe(consortium.id)
  await other.subscribe(consortium.id)
  await resolvers.Mutation.userChangePassword(null,
    { currentPassword: password, password: 'NewSecure!1' }, context(victim))
  assert.equal((await owner.disconnected).code, 4403)
  const delivered = other.nextMessage()
  await publish(consortium)
  await delivered
  assert.equal(owner.frames.filter((msg) => msg.type === 'next').length, 0)
  assert.equal(other.frames.filter((msg) => msg.type === 'next').length, 1)
})

integration('password resets and admin changes disconnect established sockets', async (t) => {
  const live = await wsHarness(t)
  let owner = await live.connect(tokenFor(victim))
  await requestReset()
  await reset(tokenFromMail())
  assert.equal((await owner.disconnected).code, 4403)
  victim = await User.findById(victim.id)
  owner = await live.connect(tokenFor(victim))
  await resolvers.Mutation.adminChangeUserPassword(null,
    { username: victim.username, password: 'AdminSecure!1' }, context(admin))
  assert.equal((await owner.disconnected).code, 4403)
})

integration('externally revoked versions cannot deliver data on an existing subscription', async (t) => {
  const live = await wsHarness(t)
  const consortium = await subscriptionFixture()
  const owner = await live.connect(tokenFor(victim))
  await owner.subscribe(consortium.id)
  await User.updateOne({ _id: victim._id }, { $inc: { tokenVersion: 1 } })
  await publish(consortium)
  assert.equal((await owner.disconnected).code, 4403)
  assert.equal(owner.frames.filter((msg) => msg.type === 'next' && msg.payload.data).length, 0)
})

integration('an established revoked socket cannot start another operation', async (t) => {
  const live = await wsHarness(t)
  const owner = await live.connect(tokenFor(victim))
  await User.updateOne({ _id: victim._id }, { $inc: { tokenVersion: 1 } })
  owner.client.subscribe({ query: '{ getUserProfile { userId } }' },
    { next: () => {}, error: () => {}, complete: () => {} })
  assert.equal((await owner.disconnected).code, 4403)
  assert.equal(owner.frames.filter((msg) => msg.type === 'next' && msg.payload.data).length, 0)
})

integration('expired tokens and deleted users cannot receive existing subscription events', async (t) => {
  const live = await wsHarness(t)
  const consortium = await subscriptionFixture()
  const expires = jwt.sign({ userId: victim.id, roles: victim.roles, tokenVersion: 0 },
    process.env.ACCESS_TOKEN_SECRET, { expiresIn: 2 })
  const expired = await live.connect(expires)
  const deleted = await live.connect(tokenFor(caller))
  await expired.subscribe(consortium.id)
  await deleted.subscribe(consortium.id)
  await User.deleteOne({ _id: caller._id })
  await delay(2100)
  await publish(consortium)
  assert.equal((await expired.disconnected).code, 4403)
  assert.equal((await deleted.disconnected).code, 4403)
  for (const connection of [expired, deleted]) {
    assert.equal(connection.frames.filter((msg) => msg.type === 'next' && msg.payload.data).length, 0)
  }
})

integration('rotating a vault token disconnects its established service-account socket', async (t) => {
  const live = await wsHarness(t)
  const server = await VaultServer.create({ user: vault._id, name: 'Test vault', description: 'Test vault' })
  const owner = await live.connect(tokenFor(vault))
  const freshToken = await resolvers.Mutation.adminRotateVaultToken(null, { serverId: server.id }, context(admin))
  assert.equal((await owner.disconnected).code, 4403)
  const fresh = await httpServerContext({ req: { headers: { 'x-access-token': freshToken } }, res: {} })
  assert.equal(String(fresh.userId), vault.id)
})

integration('HTTP reset quotas cover known and unknown emails and ignore spoofed forwarding headers', async (t) => {
  const schema = makeExecutableSchema({ typeDefs, resolvers })
  installAccountRateLimits(schema)
  const limitedServer = new ApolloServer({ schema })
  const { url } = await startStandaloneServer(limitedServer, {
    listen: { host: '127.0.0.1', port: 0 },
    context: httpServerContext,
  })
  t.after(() => limitedServer.stop())
  const request = async (username, spoofed) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json', 'x-forwarded-for': spoofed,
      },
      body: JSON.stringify({
        query: 'mutation Renamed($email:String!) { alias:requestPasswordReset(username:$email) }',
        variables: { email: username },
      }),
    })
    return response.json()
  }
  for (let i = 0; i < 5; i++) {
    const result = await request(i < 2 ? victim.username : `missing-${i}@example.test`, `198.51.100.${i}`)
    assert.equal(result.data.alias, true)
  }
  const sent = mails.length
  const denied = await request(victim.username, '203.0.113.123')
  assert.equal(denied.errors[0].extensions.code, 'TOO_MANY_REQUESTS')
  assert.equal(mails.length, sent)
})

integration('WebSocket account quotas survive operation renaming and reconnects', async (t) => {
  const live = await wsHarness(t)
  const owner = await live.connect(tokenFor(victim))
  const login = async (connection) => {
    const delivered = connection.nextMessage()
    connection.client.subscribe({
      query: 'mutation Renamed($email:String!,$password:String!) { ' +
        'alias:login(username:$email,password:$password) { userId } }',
      variables: { email: victim.username, password },
    }, { next: () => {}, error: () => {}, complete: () => {} })
    return (await delivered).payload
  }
  for (let i = 0; i < 10; i++) assert.equal((await login(owner)).data.alias.userId, victim.id)
  assert.equal((await login(owner)).errors[0].extensions.code, 'TOO_MANY_REQUESTS')
  const reconnected = await live.connect(tokenFor(victim))
  assert.equal((await login(reconnected)).errors[0].extensions.code, 'TOO_MANY_REQUESTS')
})
