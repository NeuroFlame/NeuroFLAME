import assert from 'node:assert/strict'
import test from 'node:test'
import {
  mountConfigurationErrorMessage,
} from '../dist/runCoordinator/eventHandlers/runStart/mountConfigurationError.js'

test('missing and unreadable dataset selections are distinct without exposing filesystem details', () => {
  const error = Object.assign(new Error('private filesystem details'), {
    code: 'ENOENT',
  })
  const missing = mountConfigurationErrorMessage(error)
  assert.ok(!missing.includes('private filesystem details'))
  for (const unreadable of [
    Object.assign(new Error('private filesystem details'), { code: 'EACCES' }),
    new SyntaxError('private configuration contents'),
    null,
    'ENOENT: private filesystem details',
  ]) {
    const message = mountConfigurationErrorMessage(unreadable)
    assert.notEqual(message, missing)
    assert.ok(!message.includes('private filesystem details'))
    assert.ok(!message.includes('private configuration contents'))
  }
})
