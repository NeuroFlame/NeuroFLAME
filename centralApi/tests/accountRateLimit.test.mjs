import assert from 'node:assert/strict'
import test from 'node:test'
import { graphql } from 'graphql'
import { makeExecutableSchema } from '@graphql-tools/schema'
import { createAccountRateLimiter, installAccountRateLimits } from '../dist/authentication/accountRateLimit.js'
import { createClientAddressResolver } from '../dist/authentication/clientAddress.js'

const isLimited = (error) => error.extensions?.code === 'TOO_MANY_REQUESTS'

test('account limits normalize identities, expire and bound memory without evicting active quotas', () => {
  let time = 0
  const limiter = createAccountRateLimiter({ now: () => time })
  for (let i = 0; i < 10; i++) limiter.check('login', 'client-one', i % 2 ? ' USER@example.test ' : 'user@example.test')
  assert.throws(() => limiter.check('login', 'client-one', 'user@example.test'), isLimited)
  limiter.check('login', 'client-two', 'user@example.test')
  for (let i = 0; i < 20; i++) limiter.check('login', 'client-one', `other-${i}@example.test`)
  assert.throws(() => limiter.check('login', 'client-one', 'another@example.test'), isLimited)
  time += 15 * 60_000
  limiter.check('login', 'client-one', 'user@example.test')
  const bounded = createAccountRateLimiter({ maxBuckets: 2, now: () => time })
  bounded.check('userCreate', 'first')
  assert.throws(() => bounded.check('userCreate', 'second'), isLimited)
  for (let i = 0; i < 4; i++) bounded.check('userCreate', 'first')
  assert.throws(() => bounded.check('userCreate', 'first'), isLimited)
  time += 60 * 60_000
  bounded.check('userCreate', 'second')
})

test('password and mail endpoints enforce their own quotas and the shared account-request budget', () => {
  const limits = {
    userCreate: 5,
    requestPasswordReset: 5,
    resetPassword: 20,
    userChangePassword: 10,
    adminChangeUserPassword: 20,
    adminCreateVaultUser: 20,
  }
  for (const [operation, count] of Object.entries(limits)) {
    const limiter = createAccountRateLimiter()
    for (let i = 0; i < count; i++) limiter.check(operation, 'client')
    assert.throws(() => limiter.check(operation, 'client'), isLimited)
  }
  const mail = createAccountRateLimiter()
  for (let i = 0; i < 3; i++) mail.check('requestPasswordReset', 'client', 'target@example.test')
  assert.throws(() => mail.check('requestPasswordReset', 'client', 'TARGET@example.test'), isLimited)
  const shared = createAccountRateLimiter()
  for (let i = 0; i < 30; i++) shared.check('login', 'client')
  for (let i = 0; i < 20; i++) shared.check('resetPassword', 'client')
  for (let i = 0; i < 10; i++) shared.check('userChangePassword', 'client')
  assert.throws(() => shared.check('userCreate', 'client'), isLimited)
})

test('GraphQL aliases and operation names cannot bypass limits or run the blocked mutation', async () => {
  let created = 0
  const schema = makeExecutableSchema({
    typeDefs: 'type Query { ping: Boolean! } type Mutation { userCreate(username: String!): Boolean! }',
    resolvers: { Query: { ping: () => true }, Mutation: { userCreate: () => { created++; return true } } },
  })
  installAccountRateLimits(schema)
  const contextValue = { clientAddress: 'client' }
  const source = 'mutation AnyName { a:userCreate(username:"one") ' +
    'b:userCreate(username:"two") c:userCreate(username:"three") }'
  assert.equal((await graphql({ schema, source, contextValue })).errors, undefined)
  const result = await graphql({ schema, source, contextValue })
  assert.equal(result.errors[0].extensions.code, 'TOO_MANY_REQUESTS')
  assert.ok(result.errors[0].extensions.retryAfterSeconds > 0)
  assert.equal(created, 5)
  assert.equal((await graphql({ schema, source: '{ ping }', contextValue })).data.ping, true)
})

test('forwarded IPs are ignored by default and trusted proxy chains stop at the first untrusted hop', () => {
  const request = (peer, forwarded) => ({ socket: { remoteAddress: peer }, headers: { 'x-forwarded-for': forwarded } })
  const direct = createClientAddressResolver()
  assert.equal(direct(request('::ffff:127.0.0.1', '198.51.100.1')), '127.0.0.1')
  const proxied = createClientAddressResolver('127.0.0.1,10.0.0.0/8,::1')
  assert.equal(proxied(request('127.0.0.1', '203.0.113.10, 198.51.100.2, 10.1.2.3')), '198.51.100.2')
  assert.equal(proxied(request('198.51.100.1', '203.0.113.10')), '198.51.100.1')
  assert.equal(proxied(request('::1', '2001:0db8:0:0:0:0:0:1')), '2001:db8::1')
  assert.equal(proxied(request('127.0.0.1', 'invalid')), '127.0.0.1')
  assert.equal(direct(), 'unknown')
  assert.throws(() => createClientAddressResolver('0.0.0.0/-1'))
  assert.throws(() => createClientAddressResolver('true'))
})
