import assert from 'node:assert/strict'
import test from 'node:test'
import { extractSharedError } from '../dist/runCoordinator/nodeManager/sharedError.js'

test('accepts only allowlisted shared-error envelopes', () => {
  const valid = 'NEUROFLAME_SHARED_ERROR:{"schema_version":1,"origin":"site","stage":"transfer","code":"participant_computation_failed"}'
  assert.equal(
    extractSharedError(valid, 'fallback'),
    'Participant computation failed during artifact transfer',
  )
  assert.equal(
    extractSharedError(`ordinary log line\n2026-08-06T23:59:00.123456789Z ${valid}`, 'fallback'),
    'Participant computation failed during artifact transfer',
  )

  const arbitrary = 'NEUROFLAME_SHARED_ERROR:"patient subject-123"'
  assert.equal(extractSharedError(arbitrary, 'fallback'), 'fallback')

  const injectedStage = 'NEUROFLAME_SHARED_ERROR:{"schema_version":1,"origin":"site","stage":"subject-123","code":"participant_computation_failed"}'
  assert.equal(extractSharedError(injectedStage, 'fallback'), 'fallback')

  const mismatchedOrigin = 'NEUROFLAME_SHARED_ERROR:{"schema_version":1,"origin":"site","stage":"execution","code":"central_computation_failed"}'
  assert.equal(extractSharedError(mismatchedOrigin, 'fallback'), 'fallback')

  assert.equal(
    extractSharedError(`not-a-docker-timestamp ${valid}`, 'fallback'),
    'fallback',
  )
})
