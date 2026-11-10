import assert from 'node:assert/strict'
import test from 'node:test'

import {
  disclosedRunErrorMessage,
  MAX_DISCLOSED_RUN_ERROR_BYTES,
  shouldRedactRunError,
} from '../dist/graphql/runErrorDisclosure.js'

const detail = 'Missing required covariate column: isControl'

test('hosted vault GraphQL redaction values are honored', () => {
  assert.equal(shouldRedactRunError({ reporter: 'hostedVault', requestedRedaction: true }), true)
  assert.equal(shouldRedactRunError({ reporter: 'hostedVault', requestedRedaction: false }), false)
  assert.equal(disclosedRunErrorMessage({
    errorMessage: detail,
    reporter: 'hostedVault',
    requestedRedaction: false,
  }), detail)
})

test('hosted vault redaction uses vault-policy wording', () => {
  assert.equal(disclosedRunErrorMessage({
    errorMessage: detail,
    reporter: 'hostedVault',
    requestedRedaction: true,
  }), 'Hosted vault computation failed. Detailed error was not disclosed by vault policy.')
})

test('ordinary participants cannot enable detailed disclosure', () => {
  const message = disclosedRunErrorMessage({
    errorMessage: detail,
    reporter: 'participant',
    requestedRedaction: false,
  })
  assert.equal(message.includes(detail), false)
  assert.match(message, /Detailed error is available only to that participant/)
})

test('central computation errors preserve their existing detail behavior', () => {
  assert.equal(disclosedRunErrorMessage({
    errorMessage: detail,
    reporter: 'central',
    requestedRedaction: true,
  }), detail)
})

test('oversized detailed reports are replaced with a fixed summary, never persisted', () => {
  for (const [reporter, summary] of [
    ['hostedVault', /^Hosted vault computation failed\. The detailed error exceeded the size limit\.$/],
    ['central', /^Central computation failed\. The detailed error exceeded the size limit\.$/],
  ]) {
    assert.match(disclosedRunErrorMessage({
      errorMessage: 'x'.repeat(MAX_DISCLOSED_RUN_ERROR_BYTES + 1),
      reporter,
      requestedRedaction: false,
    }), summary)
  }
})

test('central limit counts UTF-8 bytes rather than JavaScript characters', () => {
  const atLimit = '🔥'.repeat(MAX_DISCLOSED_RUN_ERROR_BYTES / 4)
  assert.equal(disclosedRunErrorMessage({
    errorMessage: atLimit,
    reporter: 'hostedVault',
    requestedRedaction: false,
  }), atLimit)
  assert.match(disclosedRunErrorMessage({
    errorMessage: `${atLimit}🔥`,
    reporter: 'hostedVault',
    requestedRedaction: false,
  }), /exceeded the size limit/)
})

test('oversized redacted input is never persisted', () => {
  const message = disclosedRunErrorMessage({
    errorMessage: 'x'.repeat(MAX_DISCLOSED_RUN_ERROR_BYTES + 1),
    reporter: 'participant',
    requestedRedaction: false,
  })
  assert.match(message, /Detailed error is available only to that participant/)
})
