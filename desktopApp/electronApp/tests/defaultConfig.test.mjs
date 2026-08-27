import assert from 'node:assert/strict'
import test from 'node:test'
import { defaultConfig, testConfig } from '../build/defaultConfig.js'

test('production defaults connect to the Trends Center deployment', () => {
  assert.equal(
    defaultConfig.centralServerQueryUrl,
    'https://trendscenterdev.org/graphql',
  )
  assert.equal(
    defaultConfig.centralServerSubscriptionUrl,
    'wss://trendscenterdev.org/graphql',
  )
  assert.equal(
    defaultConfig.edgeClientConfig.authenticationEndpoint,
    'https://trendscenterdev.org/authenticateToken',
  )
  assert.equal(
    defaultConfig.edgeClientConfig.httpUrl,
    defaultConfig.centralServerQueryUrl,
  )
  assert.equal(
    defaultConfig.edgeClientConfig.wsUrl,
    defaultConfig.centralServerSubscriptionUrl,
  )
})

test('runtime-derived paths remain blank in the shipped defaults', () => {
  assert.equal(defaultConfig.logPath, '')
  assert.equal(defaultConfig.edgeClientConfig.logPath, '')
  assert.equal(defaultConfig.edgeClientConfig.pathBaseDirectory, '')
})

test('test defaults remain local', () => {
  assert.equal(testConfig.centralServerQueryUrl, 'http://localhost:3001/graphql')
  assert.equal(testConfig.edgeClientConfig.httpUrl, testConfig.centralServerQueryUrl)
})
