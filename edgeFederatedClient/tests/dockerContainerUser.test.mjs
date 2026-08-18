import assert from 'node:assert/strict'
import test from 'node:test'
import { dockerContainerUser } from '../dist/runCoordinator/nodeManager/dockerContainerUser.js'

test('runs a POSIX Docker container as the federated-client file owner', () => {
  assert.equal(dockerContainerUser('linux', 1001, 1002), '1001:1002')
  assert.equal(dockerContainerUser('darwin', 501, 20), '501:20')
})

test('leaves Docker user selection unchanged where POSIX IDs are unavailable', () => {
  assert.equal(dockerContainerUser('win32', 1001, 1002), undefined)
  assert.equal(dockerContainerUser('linux', undefined, 1002), undefined)
  assert.equal(dockerContainerUser('linux', 1001, undefined), undefined)
})
