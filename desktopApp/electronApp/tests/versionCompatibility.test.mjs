import assert from 'node:assert/strict'
import test from 'node:test'
import {
  compareAppAndApiVersions,
  versionEndpoint,
} from '../build/versionCompatibility.js'

test('patch releases remain compatible', () => {
  assert.equal(compareAppAndApiVersions('0.8.0', '0.8.7').status, 'compatible')
})

test('a newer API requires a desktop update', () => {
  assert.equal(
    compareAppAndApiVersions('0.8.9', '0.9.0').status,
    'appUpdateRequired',
  )
})

test('an older or invalid API requires a server update', () => {
  assert.equal(
    compareAppAndApiVersions('0.9.0', '0.8.9').status,
    'serverUpdateRequired',
  )
  assert.equal(
    compareAppAndApiVersions('0.8.0', 'legacy').status,
    'serverUpdateRequired',
  )
})

test('the version endpoint follows a configured GraphQL path', () => {
  assert.equal(
    versionEndpoint('https://example.test/neuroflame/graphql'),
    'https://example.test/neuroflame/version',
  )
})
