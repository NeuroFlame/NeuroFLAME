import assert from 'node:assert/strict'
import { after, before, beforeEach, mock, test } from 'node:test'
import { createHash, randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import mongoose from 'mongoose'
import { Resend } from 'resend'
import { ApolloServer } from '@apollo/server'
import { makeExecutableSchema } from '@graphql-tools/schema'
import jwt from 'jsonwebtoken'

// Resolver-level integration tests against a real MongoDB.
const mongoURI = process.env.MONGODB_SECURITY_TEST_URI
const integration = (name, fn) => test(name, { skip: !mongoURI, timeout: 15000 }, fn)
let User, Consortium, Run, Invite, resolvers, pubsub, generateTokens, hashPassword, COMPUTATION_API_VERSION
let server, originalHash, mails, edgeStarts, edgeSubscription
let victim, caller, vault, admin, central
const password = 'OriginalSecure!1'
const context = (user) => ({ userId: String(user._id), roles: user.roles })
const digest = (token) => createHash('sha256').update(token).digest('hex')

before(async () => {
  if (!mongoURI) return
  Object.assign(process.env, {
    CLIENT_FILE_SERVER_URL: 'http://127.0.0.1:3998',
    APOLLO_PORT: '3999',
    DATABASE_URI: mongoURI,
    RESEND_API_KEY: 're_test',
    ACCESS_TOKEN_SECRET: 'isolated-integration-secret',
    ACCESS_TOKEN_DURATION: '1h',
    CONSORTIUM_INVITE_URL: 'http://127.0.0.1:3999/invite',
  })
  const modules = await Promise.all([
    import('../dist/database/models/User.js'), import('../dist/database/models/Consortium.js'),
    import('../dist/database/models/Run.js'), import('../dist/database/models/Invite.js'),
    import('../dist/graphql/resolvers.js'), import('../dist/graphql/pubSubService.js'),
    import('../dist/authentication/authentication.js'), import('../dist/graphql/generated/typeDefs.js'),
    import('../dist/versions.js'),
  ])
  User = modules[0].default
  Consortium = modules[1].default
  Run = modules[2].default
  Invite = modules[3].default
  resolvers = modules[4].default
  pubsub = modules[5].default
  ;({ generateTokens, hashPassword } = modules[6])
  ;({ COMPUTATION_API_VERSION } = modules[8])
  await mongoose.connect(mongoURI, { dbName: `integration_${randomUUID().replaceAll('-', '')}` })
  originalHash = await hashPassword(password)
  mock.method(Resend.prototype, 'post', async (_path, payload) => {
    mails.push(payload)
    return { data: { id: 'stub' }, error: null }
  })
  server = new ApolloServer({ schema: makeExecutableSchema({ typeDefs: modules[7].typeDefs, resolvers }) })
  await server.start()
  edgeSubscription = await pubsub.subscribe('RUN_START_EDGE', () => { edgeStarts++ })
})

beforeEach(async () => {
  if (!mongoURI) return
  await Promise.all([User, Consortium, Run, Invite, mongoose.model('Computation')].map((model) => model.deleteMany({})))
  mails = []
  edgeStarts = 0
  ;[victim, caller, vault, admin, central] = await User.create([
    { username: 'victim@example.test', hash: originalHash },
    { username: 'caller@example.test', hash: originalHash },
    { username: 'vault@example.test', hash: originalHash, roles: ['vault'] },
    { username: 'admin@example.test', hash: originalHash, roles: ['admin'] },
    { username: 'central@example.test', hash: originalHash, roles: ['central'] },
  ])
})

after(async () => {
  if (!mongoURI) return
  if (edgeSubscription) pubsub.unsubscribe(edgeSubscription)
  if (server) await server.stop()
  if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase()
  await mongoose.disconnect()
  mock.restoreAll()
})

integration('vault directory hides operational vault details from non-admin callers', async () => {
  const computation = await mongoose.model('Computation').create({
    title: 'Restricted computation', imageName: 'example/restricted:1', imageDownloadUrl: 'https://example.test', notes: 'n',
  })
  const privateConsortium = await Consortium.create({
    title: 'Private consortium title',
    leader: admin._id,
    isPrivate: true,
    studyConfiguration: { computationParameters: '{}' },
  })
  await User.updateOne({ _id: vault._id }, {
    vault: {
      name: 'Public vault name',
      description: 'Public description',
      allowedComputations: [computation._id],
      datasetMappings: [{ computationId: computation._id, datasetKey: 'mapped-key' }],
    },
    vaultStatus: {
      status: 'online',
      version: '1.0.0',
      uptime: 1,
      websocketConnected: true,
      lastHeartbeat: new Date(),
      runningComputations: [{ runId: 'secret-run-id', consortiumId: privateConsortium.id, startedAt: new Date() }],
      availableDatasets: [{ key: 'dataset-key', path: '/srv/private/dataset/path' }],
    },
  })

  const [publicEntry] = await resolvers.Query.getVaultUserList(null, null, context(caller))
  assert.deepEqual(publicEntry, {
    id: vault.id,
    username: 'Public vault name',
    vault: {
      name: 'Public vault name',
      description: 'Public description',
      allowedComputations: [{ id: computation.id, title: 'Restricted computation', imageName: 'example/restricted:1' }],
      datasetMappings: [],
    },
    vaultStatus: null,
  })
  const serialized = JSON.stringify(publicEntry)
  const secrets = ['/srv/private', 'secret-run-id', 'Private consortium title', privateConsortium.id, 'mapped-key']
  for (const secret of secrets) {
    assert.ok(!serialized.includes(secret), `non-admin response leaked ${secret}`)
  }

  for (const viewer of [admin, vault]) {
    const [detailed] = await resolvers.Query.getVaultUserList(null, null, context(viewer))
    assert.equal(detailed.username, vault.username)
    assert.equal(detailed.vaultStatus.availableDatasets[0].path, '/srv/private/dataset/path')
    assert.equal(detailed.vaultStatus.runningComputations[0].consortiumTitle, 'Private consortium title')
    assert.equal(detailed.vault.allowedComputations[0].id, computation.id)
  }
})

integration('signed-in users create computations and only the owner can change one', async () => {
  const Computation = mongoose.model('Computation')
  const fields = {
    title: 'Owned computation', imageName: 'example/owned:1', imageDownloadUrl: 'https://example.test', notes: 'n',
  }
  const create = (contextValue, title) => server.executeOperation({
    query: `mutation { computationCreate(title: "${title}", imageName: "example/any:1",
      imageDownloadUrl: "https://example.test", notes: "n", hasLocalParameters: false) }`,
  }, { contextValue })
  assert.match((await create({}, 'Anonymous')).body.singleResult.errors[0].message, /not authenticated/)
  assert.equal(await Computation.countDocuments(), 0)
  assert.equal(await resolvers.Mutation.computationCreate(null, fields, context(caller)), true)
  const computation = await Computation.findOne({ title: fields.title })
  assert.equal(String(computation.owner), String(caller._id))

  // Being an admin does not make someone the owner.
  for (const contextValue of [{}, context(victim), context(admin)]) {
    await assert.rejects(resolvers.Mutation.computationEdit(null, {
      computationId: computation.id, imageName: 'example/evil:1',
    }, contextValue), /not authenticated|not authorized/)
  }
  assert.equal((await Computation.findById(computation.id)).imageName, 'example/owned:1')
  assert.equal(await resolvers.Mutation.computationEdit(null, {
    computationId: computation.id, imageName: 'example/owned:2',
  }, context(caller)), true)
  assert.equal((await Computation.findById(computation.id)).imageName, 'example/owned:2')
  // An edit that only changes the local-parameters flag is a real edit.
  assert.equal(await resolvers.Mutation.computationEdit(null, {
    computationId: computation.id, hasLocalParameters: true,
  }, context(caller)), true)
  assert.equal((await Computation.findById(computation.id)).hasLocalParameters, true)
})

integration('the token check used by the file server and edge clients refuses revoked tokens', async () => {
  const { authenticateToken } = await import('../dist/authentication/authenticateTokenRoute.js')
  const check = async (token) => {
    const res = {
      statusCode: 0,
      body: undefined,
      status(code) { this.statusCode = code; return this },
      json(body) { this.body = body; return this },
      send(body) { this.body = body; return this },
    }
    await authenticateToken({ body: { token } }, res)
    return res
  }
  const oldToken = generateTokens({ userId: victim.id, roles: ['admin'], tokenVersion: 0 }).accessToken
  const current = await check(oldToken)
  assert.equal(current.statusCode, 200)
  assert.deepEqual(current.body.decodedAccessToken.roles, victim.roles)

  await User.updateOne({ _id: victim._id }, { $inc: { tokenVersion: 1 } })
  assert.equal((await check(oldToken)).statusCode, 401)

  const download = generateTokens({ participantId: victim.id, runId: 'r', consortiumId: 'c' }).accessToken
  const downloadResult = await check(download)
  assert.equal(downloadResult.statusCode, 200)
  assert.equal(downloadResult.body.decodedAccessToken.participantId, victim.id)
  assert.equal((await check('not-a-token')).statusCode, 401)
  assert.equal((await check(undefined)).statusCode, 400)
})

integration('invite emails escape user text, and invite links are stored only as digests', async () => {
  const leader = await User.create({ username: 'lead<b>er@example.test', hash: originalHash })
  const consortium = await Consortium.create({
    title: '<a href="https://evil.test">Claim prize</a>\r\nBcc: everyone@example.test',
    leader: leader._id,
    members: [leader._id],
    studyConfiguration: {},
  })
  assert.equal(await resolvers.Mutation.consortiumInvite(null, {
    consortiumId: consortium.id, email: caller.username,
  }, context(leader)), true)

  const mail = mails.at(-1)
  assert.ok(!mail.html.includes('<a href="https://evil.test">'))
  assert.ok(!mail.html.includes('<b>'))
  assert.match(mail.html, /&lt;a href=&quot;https:\/\/evil\.test&quot;&gt;Claim prize&lt;\/a&gt;/)
  assert.ok(!/[\r\n]/.test(mail.subject))
  const token = mail.html.match(/invite\/([a-f0-9]{64})/)[1]

  const stored = await Invite.collection.findOne({ consortium: consortium._id })
  assert.equal(stored.token, undefined)
  assert.equal(stored.tokenDigest, digest(token))
  assert.ok(!JSON.stringify(stored).includes(token))

  assert.equal((await resolvers.Query.getInviteInfo(null, { inviteToken: token })).isExpired, false)
  for (const inviteToken of [stored.tokenDigest, 'not-a-token', { $ne: '' }]) {
    await assert.rejects(resolvers.Query.getInviteInfo(null, { inviteToken }), /Invalid invite link/)
  }
  assert.equal(await resolvers.Mutation.consortiumJoinByInvite(null, { inviteToken: token }, context(caller)), true)

  // Invites stored before this change kept the link token in plaintext.
  const { backfillInviteTokenDigests } = await import('../dist/database/backfillInviteTokenDigests.js')
  const legacyConsortium = await Consortium.create({
    title: 'Legacy', leader: victim._id, members: [victim._id], studyConfiguration: {},
  })
  const legacyToken = 'b'.repeat(64)
  await Invite.collection.insertOne({
    leader: victim._id,
    consortium: legacyConsortium._id,
    email: caller.username,
    token: legacyToken,
    createdAt: new Date(),
  })
  assert.equal(await backfillInviteTokenDigests(), 1)
  assert.equal(await backfillInviteTokenDigests(), 0)
  const legacy = await Invite.collection.findOne({ consortium: legacyConsortium._id })
  assert.equal(legacy.token, undefined)
  assert.equal(legacy.tokenDigest, digest(legacyToken))
  const joined = await resolvers.Mutation.consortiumJoinByInvite(null, { inviteToken: legacyToken }, context(caller))
  assert.equal(joined, true)
})

integration('sign-in tokens expire while vault service tokens stay long-lived', async () => {
  const { validateServerAccessToken } = await import('../dist/serverContexts.js')
  const login = await resolvers.Mutation.login(null, { username: victim.username, password })
  const { iat, exp } = jwt.decode(login.accessToken)
  assert.equal(exp - iat, 60 * 60) // ACCESS_TOKEN_DURATION in this test environment
  assert.equal(String((await validateServerAccessToken(login.accessToken)).userId), victim.id)

  // Never-expiring sign-in tokens issued before this change are retired.
  const legacy = generateTokens({ userId: victim.id, roles: victim.roles, tokenVersion: 0 }, { shouldExpire: false })
  await assert.rejects(validateServerAccessToken(legacy.accessToken), /expired/)
  const forgedRole = generateTokens({ userId: victim.id, roles: ['vault'], tokenVersion: 0 }, { shouldExpire: false })
  await assert.rejects(validateServerAccessToken(forgedRole.accessToken), /expired/)

  const vaultToken = generateTokens({ userId: vault.id, roles: vault.roles, tokenVersion: 0 }, { shouldExpire: false })
  assert.equal(jwt.decode(vaultToken.accessToken).exp, undefined)
  assert.equal(String((await validateServerAccessToken(vaultToken.accessToken)).userId), vault.id)
  const created = await resolvers.Mutation.adminCreateVaultUser(null, {
    username: 'new-vault@example.test', password,
  }, { userId: admin.id, roles: admin.roles })
  assert.equal(jwt.decode(created.accessToken).exp, undefined)
})

const createRun = async (status = 'Provisioning') => {
  const consortium = await Consortium.create({
    title: `Lifecycle ${randomUUID()}`,
    leader: victim._id,
    members: [victim._id],
    activeMembers: [victim._id],
    studyConfiguration: { computationParameters: '{}' },
  })
  return Run.create({
    consortium: consortium._id,
    consortiumLeader: victim._id,
    members: [victim._id],
    status,
    studyConfiguration: {
      computationParameters: '{}',
      computation: { title: 'Computation', imageName: 'example/c:1', imageDownloadUrl: 'https://example.test', notes: 'n' },
    },
  })
}
const imageDigest = `sha256:${'d'.repeat(64)}`
const ready = (run) => resolvers.Mutation.reportRunReady(null, {
  runId: run.id,
  resolvedImage: {
    sourceImage: 'example/c:1',
    reference: `example/c@${imageDigest}`,
    digest: imageDigest,
    metadata: {
      title: 'Computation',
      computationVersion: '1.0.0',
      revision: 'abcdef1',
      source: 'https://example.test',
      computationApiVersion: COMPUTATION_API_VERSION,
      boilerplateVersion: '0.1.0',
      nvflareVersion: '2.8.0',
    },
  },
}, context(central))
const fail = (run, user, vaultId) => resolvers.Mutation.reportRunError(null, {
  runId: run.id, vaultId, errorMessage: 'failed',
}, context(user))
const complete = (run) => resolvers.Mutation.reportRunComplete(null, { runId: run.id }, context(central))
const status = async (run) => (await Run.findById(run.id).lean()).status

integration('run status only moves forward: late, duplicate and conflicting reports are refused', async () => {
  // A central failure before readiness cannot be revived by a late ready report.
  const failedEarly = await createRun()
  assert.equal(await fail(failedEarly, central), true)
  assert.equal(await ready(failedEarly), false)
  assert.equal(await status(failedEarly), 'Error')

  // Duplicate ready reports start participants once.
  const run = await createRun()
  assert.equal(await ready(run), true)
  assert.equal(await ready(run), false)
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(edgeStarts, 1)

  // A participant failure is not overwritten by central completion.
  assert.equal(await fail(run, victim), true)
  assert.equal(await complete(run), false)
  assert.equal(await status(run), 'Error')
})

integration('a vault account in a run as an ordinary member can report a failure without a vault id', async () => {
  const run = await createRun('In Progress')
  await Run.updateOne({ _id: run._id }, { $push: { members: vault._id } })
  assert.equal(await fail(run, vault, null), true)
  const updated = await Run.findById(run.id)
  assert.equal(updated.status, 'Error')
  assert.equal(updated.runErrors.at(-1).user.toString(), vault.id)
})

const membershipConsortium = () => {
  const everyone = [victim._id, caller._id, vault._id]
  return Consortium.create({
    title: 'Membership',
    description: 'Original description',
    leader: victim._id,
    members: everyone,
    activeMembers: everyone,
    readyMembers: everyone,
    studyConfiguration: { computationParameters: '{}' },
  })
}

integration('a leader hands over to a current member before leaving, and cannot be removed', async () => {
  const consortium = await membershipConsortium()
  const leave = (user, newLeaderId) =>
    resolvers.Mutation.consortiumLeave(null, { consortiumId: consortium.id, newLeaderId }, context(user))
  await assert.rejects(leave(victim), /Choose a new leader/)
  await assert.rejects(leave(victim, admin.id), /another member/)
  await assert.rejects(leave(victim, vault.id), /not a vault/)
  await assert.rejects(resolvers.Mutation.leaderRemoveMember(null, {
    consortiumId: consortium.id, userId: victim.id,
  }, context(victim)), /leader cannot be removed/)

  assert.equal(await leave(victim, caller.id), true)
  const updated = await Consortium.findById(consortium.id)
  assert.equal(updated.leader.toString(), caller.id)
  assert.ok(!updated.members.some((id) => id.toString() === victim.id))

  // The new leader can clear the description.
  assert.equal(await resolvers.Mutation.consortiumEdit(null, {
    consortiumId: consortium.id, title: 'Membership', description: '',
  }, context(caller)), true)
  assert.equal((await Consortium.findById(consortium.id)).description, '')
})

// Resolves with the next event payload delivered to this user, or 'none' after a pause.
const nextEvent = async (subscription, args, user) => {
  const iterator = await subscription.subscribe(null, args, context(user), {})
  const next = iterator.next().then(({ value }) => value)
  return {
    received: () => Promise.race([next, delay(300).then(() => 'none')]),
    close: () => iterator.return?.(),
  }
}

integration('removed and former members hear about removals and deletions; outsiders do not', async () => {
  const consortium = await membershipConsortium()
  const details = resolvers.Subscription.consortiumDetailsChanged
  const args = { consortiumId: consortium.id }

  const removed = await nextEvent(details, args, caller)
  await resolvers.Mutation.leaderRemoveMember(null, { consortiumId: consortium.id, userId: caller.id }, context(victim))
  assert.equal((await removed.received()).consortiumId, consortium.id)

  const run = await Run.create({
    consortium: consortium._id,
    consortiumLeader: victim._id,
    members: [victim._id, vault._id],
    status: 'Complete',
    studyConfiguration: {
      computationParameters: '{}',
      computation: { title: 'C', imageName: 'example/c:1', imageDownloadUrl: 'https://example.test', notes: 'n' },
    },
  })
  const runForMember = await nextEvent(resolvers.Subscription.runDetailsChanged, { runId: run.id }, vault)
  const runForOutsider = await nextEvent(resolvers.Subscription.runDetailsChanged, { runId: run.id }, admin)
  assert.equal(await resolvers.Mutation.runDelete(null, { runId: run.id }, context(victim)), true)
  assert.equal((await runForMember.received()).runId, run.id)
  assert.equal(await runForOutsider.received(), 'none')

  const forMember = await nextEvent(details, args, vault)
  const forOutsider = await nextEvent(details, args, admin)
  await resolvers.Mutation.consortiumDelete(null, { consortiumId: consortium.id }, context(victim))
  assert.equal((await forMember.received()).consortiumId, consortium.id)
  assert.equal(await forOutsider.received(), 'none')
  for (const subscription of [removed, runForMember, runForOutsider, forMember, forOutsider]) subscription.close()
})
