import assert from 'node:assert/strict'
import test from 'node:test'

import {
  parseVaultErrorDisclosure,
} from '../dist/errorDisclosure.js'

test('vault error disclosure defaults to redacted', () => {
  assert.equal(parseVaultErrorDisclosure(undefined), 'redacted')
  assert.equal(parseVaultErrorDisclosure(''), 'redacted')
})

test('vault error disclosure accepts normalized supported values', () => {
  assert.equal(parseVaultErrorDisclosure(' REDACTED '), 'redacted')
  assert.equal(parseVaultErrorDisclosure('Detailed'), 'detailed')
})

test('vault error disclosure rejects invalid values', () => {
  assert.throws(
    () => parseVaultErrorDisclosure('verbose'),
    /must be redacted or detailed/,
  )
})
