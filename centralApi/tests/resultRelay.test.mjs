import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

process.env.APOLLO_PORT ||= '3001'
process.env.CLIENT_FILE_SERVER_URL ||= 'http://localhost:3003'
process.env.DATABASE_URI ||= 'mongodb://localhost/test'
process.env.RESEND_API_KEY ||= 'test'
process.env.ACCESS_TOKEN_SECRET ||= 'test'
process.env.ACCESS_TOKEN_DURATION ||= '1h'
process.env.CONSORTIUM_INVITE_URL ||= 'http://localhost/invite'

const {
  normalizeRelativePath,
  normalizeRelayResponse,
  ResultRelayRateLimiter,
} = await import('../dist/mcp/resultRelay.js')

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

describe('central MCP derivative result validation', () => {
  it('accepts bounded text and supported image blocks', () => {
    assert.deepEqual(normalizeRelayResponse({
      operation: 'report',
      relativePath: null,
      blocks: [
        { type: 'text', text: 'serialized derivative report' },
        { type: 'image', data: png, mimeType: 'image/png' },
      ],
    }, 'report', null)?.blocks.length, 2)
  })

  it('rejects extra metadata, bad signatures, and operation-shape mismatches', () => {
    assert.equal(normalizeRelayResponse({
      operation: 'read',
      relativePath: 'figure.png',
      blocks: [{ type: 'image', data: png, mimeType: 'image/png', _meta: { path: '/private' } }],
    }, 'read', 'figure.png'), undefined)
    assert.equal(normalizeRelayResponse({
      operation: 'read',
      relativePath: 'figure.png',
      blocks: [{ type: 'image', data: 'aGVsbG8=', mimeType: 'image/png' }],
    }, 'read', 'figure.png'), undefined)
    assert.equal(normalizeRelayResponse({
      operation: 'read',
      relativePath: 'figure.png',
      blocks: [
        { type: 'image', data: png, mimeType: 'image/png' },
        { type: 'text', text: 'extra' },
      ],
    }, 'read', 'figure.png'), undefined)
    assert.equal(normalizeRelayResponse({
      operation: 'list',
      relativePath: null,
      blocks: [{ type: 'image', data: png, mimeType: 'image/png' }],
    }, 'list', null), undefined)
  })

  it('rejects responses over the total relay limit', () => {
    assert.equal(normalizeRelayResponse({
      operation: 'read',
      relativePath: 'summary.txt',
      blocks: [{ type: 'text', text: 'x'.repeat(12 * 1024 * 1024 + 1) }],
    }, 'read', 'summary.txt'), undefined)
  })

  it('binds file reads to their normalized requested path', () => {
    assert.equal(normalizeRelayResponse({
      operation: 'read',
      relativePath: 'other.txt',
      blocks: [{ type: 'text', text: 'result' }],
    }, 'read', 'summary.txt'), undefined)
  })

  it('rejects Windows absolute, drive-relative, UNC, and device paths', () => {
    const invalidPaths = [
      'C:\\Users\\patient\\summary.txt',
      'C:/Users/patient/summary.txt',
      'C:relative.txt',
      '\\\\server\\share\\summary.txt',
      '\\\\?\\C:\\Users\\patient\\summary.txt',
      '\\\\.\\PhysicalDrive0',
    ]
    for (const invalidPath of invalidPaths) {
      assert.throws(() => normalizeRelativePath(invalidPath), /Invalid derivative result path/)
      assert.equal(normalizeRelayResponse({
        operation: 'list',
        relativePath: null,
        blocks: [{
          type: 'text',
          text: JSON.stringify([{ path: invalidPath, type: 'file', size: 1 }]),
        }],
      }, 'list', null), undefined)
    }
  })

  it('rate-limits repeated result requests per connection and user', () => {
    const limiter = new ResultRelayRateLimiter()
    for (let request = 0; request < 20; request += 1) {
      assert.equal(limiter.allow('user', 'family', 1), true)
    }
    assert.equal(limiter.allow('user', 'family', 1), false)

    const userLimiter = new ResultRelayRateLimiter()
    for (let request = 0; request < 40; request += 1) {
      assert.equal(userLimiter.allow('user', `family-${request}`, 1), true)
    }
    assert.equal(userLimiter.allow('user', 'family-last', 1), false)
  })
})
