import assert from 'node:assert/strict'
import test from 'node:test'
import { autoUpdateEligibility } from '../build/autoUpdatePolicy.js'

test('updates are disabled for development builds', () => {
  assert.deepEqual(autoUpdateEligibility(false, 'linux', '/tmp/app.AppImage'), {
    enabled: false,
    reason: 'development',
  })
})

test('packaged Linux updates require an AppImage launch', () => {
  assert.deepEqual(autoUpdateEligibility(true, 'linux'), {
    enabled: false,
    reason: 'linux-not-appimage',
  })
  assert.deepEqual(
    autoUpdateEligibility(true, 'linux', '/opt/NeuroFlame.AppImage'),
    { enabled: true },
  )
})

test('packaged macOS and Windows builds can update', () => {
  assert.deepEqual(autoUpdateEligibility(true, 'darwin'), { enabled: true })
  assert.deepEqual(autoUpdateEligibility(true, 'win32'), { enabled: true })
})

test('unsupported packaged platforms do not attempt updates', () => {
  assert.deepEqual(autoUpdateEligibility(true, 'freebsd'), {
    enabled: false,
    reason: 'unsupported-platform',
  })
})
