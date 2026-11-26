import assert from 'node:assert/strict'
import test from 'node:test'
import { getProductionClient } from '../build/productionClient.js'

test('production selection rejects ambiguous or unsafe arguments', () => {
  assert.equal(getProductionClient(['.', '--']), undefined)
  assert.equal(getProductionClient(['.', '--production-client=2']), 2)
  for (const value of ['', '0', '100', '-1', '1.5', '../other', '01']) {
    assert.throws(() => getProductionClient([`--production-client=${value}`]))
  }
  assert.throws(() => getProductionClient(['--production-client']))
  assert.throws(() => getProductionClient(['--production-client=1', '--production-client=2']))
})
