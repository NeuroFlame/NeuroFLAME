import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto'
import { win32 } from 'path'
import { Router, json } from 'express'
import Run from '../database/models/Run.js'
import McpGrant from '../database/models/McpGrant.js'
import User from '../database/models/User.js'
import pubsub from '../graphql/pubSubService.js'
import { MCP_PUBLIC_URL } from '../config.js'
import { logger } from '../logger.js'

export type RelayOperation = 'report' | 'list' | 'read'

export interface RelayTextBlock {
  type: 'text'
  text: string
}

export interface RelayImageBlock {
  type: 'image'
  data: string
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp'
}

export interface RelayResult {
  blocks: Array<RelayTextBlock | RelayImageBlock>
}

interface PendingRelay {
  userId: string
  familyId: string
  authorizationEpoch: number
  runId: string
  consortiumId: string
  operation: RelayOperation
  relativePath: string | null
  tokenHash: string
  expiresAt: number
  resolve: (result: RelayResult) => void
  reject: (error: Error) => void
  timer: NodeJS.Timeout
}

const pending = new Map<string, PendingRelay>()
const RELAY_TIMEOUT_MS = 30_000
const MAX_PENDING_PER_FAMILY = 3
const MAX_PENDING_PER_USER = 5
const MAX_PENDING_GLOBAL = 100
const RATE_WINDOW_MS = 60_000
const MAX_REQUESTS_PER_FAMILY_WINDOW = 20
const MAX_REQUESTS_PER_USER_WINDOW = 40
const MAX_RELAY_BYTES = 12 * 1024 * 1024
const MAX_LIST_ENTRIES = 500
const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.m', '.csv', '.json', '.html', '.htm'])
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp'])

export class ResultRelayRateLimiter {
  private readonly families = new Map<string, number[]>()
  private readonly users = new Map<string, number[]>()

  allow(userId: string, familyId: string, now = Date.now()): boolean {
    this.prune(this.families, now)
    this.prune(this.users, now)
    return this.consume(this.families, familyId, MAX_REQUESTS_PER_FAMILY_WINDOW, now) &&
      this.consume(this.users, userId, MAX_REQUESTS_PER_USER_WINDOW, now)
  }

  private prune(buckets: Map<string, number[]>, now: number): void {
    for (const [key, values] of buckets) {
      if (!values.some((value) => value > now - RATE_WINDOW_MS)) buckets.delete(key)
    }
  }

  private consume(
    buckets: Map<string, number[]>,
    key: string,
    limit: number,
    now: number,
  ): boolean {
    const recent = (buckets.get(key) || []).filter((value) => value > now - RATE_WINDOW_MS)
    if (recent.length >= limit) {
      buckets.set(key, recent)
      return false
    }
    recent.push(now)
    buckets.set(key, recent)
    return true
  }
}

const relayRateLimiter = new ResultRelayRateLimiter()

export function cancelPendingResultsForUser(userId: string): void {
  for (const [requestId, relay] of pending.entries()) {
    if (relay.userId !== userId) continue
    clearTimeout(relay.timer)
    pending.delete(requestId)
    relay.reject(new Error('MCP derivative result access was disabled'))
  }
}

export function cancelPendingResultsForFamily(familyId: string): void {
  for (const [requestId, relay] of pending.entries()) {
    if (relay.familyId !== familyId) continue
    clearTimeout(relay.timer)
    pending.delete(requestId)
    relay.reject(new Error('MCP connection was revoked'))
  }
}

const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex')

const relayTokenMatches = (supplied: string, expectedHash: string): boolean => {
  const suppliedHash = Buffer.from(hashToken(supplied), 'hex')
  const expected = Buffer.from(expectedHash, 'hex')
  return suppliedHash.length === expected.length && timingSafeEqual(suppliedHash, expected)
}

const hasExactKeys = (value: Record<string, unknown>, keys: string[]): boolean => {
  const actual = Object.keys(value).sort()
  return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index])
}

export const normalizeRelativePath = (value: string): string => {
  if (
    !value ||
    value.includes('\0') ||
    value.startsWith('/') ||
    value.startsWith('\\') ||
    win32.isAbsolute(value) ||
    /^[A-Za-z]:/.test(value)
  ) {
    throw new Error('Invalid derivative result path')
  }
  const segments = value.split(/[\\/]+/)
  if (segments.some((segment) =>
    !segment || segment === '.' || segment === '..' || segment.startsWith('.') ||
    segment.toLowerCase().endsWith('.log'),
  )) throw new Error('Invalid derivative result path')
  return segments.join('/')
}

const normalizeImage = (block: Record<string, unknown>): RelayImageBlock | undefined => {
  if (!hasExactKeys(block, ['type', 'data', 'mimeType'])) return undefined
  if (
    block.type !== 'image' ||
    typeof block.data !== 'string' ||
    !['image/png', 'image/jpeg', 'image/webp'].includes(String(block.mimeType)) ||
    block.data.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(block.data)
  ) return undefined
  const data = Buffer.from(block.data, 'base64')
  if (data.toString('base64') !== block.data) return undefined
  const signatureValid =
    (block.mimeType === 'image/png' &&
      data.length >= 33 &&
      data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
      data.subarray(12, 16).toString() === 'IHDR' &&
      data.subarray(-8, -4).toString() === 'IEND') ||
    (block.mimeType === 'image/jpeg' &&
      data.length >= 4 &&
      data[0] === 0xff &&
      data[1] === 0xd8 &&
      data.at(-2) === 0xff &&
      data.at(-1) === 0xd9) ||
    (block.mimeType === 'image/webp' && data.length >= 16 &&
      data.subarray(0, 4).toString() === 'RIFF' &&
      data.subarray(8, 12).toString() === 'WEBP' &&
      data.readUInt32LE(4) + 8 === data.length &&
      ['VP8 ', 'VP8L', 'VP8X'].includes(data.subarray(12, 16).toString()))
  if (!signatureValid) return undefined
  return { type: 'image', data: block.data, mimeType: block.mimeType as RelayImageBlock['mimeType'] }
}

const normalizeBlocks = (blocks: unknown): RelayResult['blocks'] | undefined => {
  if (!Array.isArray(blocks) || blocks.length === 0 || blocks.length > 5) return undefined
  const normalized: RelayResult['blocks'] = []
  let totalBytes = 0
  for (const block of blocks) {
    if (!block || typeof block !== 'object') return undefined
    const typed = block as Record<string, unknown>
    if (
      typed.type === 'text' &&
      typeof typed.text === 'string' &&
      hasExactKeys(typed, ['type', 'text'])
    ) {
      totalBytes += Buffer.byteLength(typed.text)
      normalized.push({ type: 'text', text: typed.text })
    } else {
      const image = normalizeImage(typed)
      if (!image) return undefined
      totalBytes += Buffer.byteLength(image.data, 'base64')
      normalized.push(image)
    }
    if (totalBytes > MAX_RELAY_BYTES) return undefined
  }
  return normalized
}

export function normalizeRelayResponse(
  value: unknown,
  expectedOperation: RelayOperation,
  expectedRelativePath: string | null,
): RelayResult | undefined {
  if (!value || typeof value !== 'object') return undefined
  const envelope = value as Record<string, unknown>
  if (!hasExactKeys(envelope, ['operation', 'relativePath', 'blocks'])) return undefined
  if (
    envelope.operation !== expectedOperation ||
    envelope.relativePath !== expectedRelativePath
  ) return undefined
  const blocks = normalizeBlocks(envelope.blocks)
  if (!blocks) return undefined
  if (expectedOperation === 'read') {
    if (blocks.length !== 1) return undefined
  } else if (expectedOperation === 'report') {
    if (
      blocks[0]?.type !== 'text' ||
      blocks.slice(1).some((block) => block.type !== 'image')
    ) return undefined
  } else {
    if (blocks.length !== 1 || blocks[0]?.type !== 'text') return undefined
    let entries: unknown
    try { entries = JSON.parse(blocks[0].text) } catch { return undefined }
    if (!Array.isArray(entries) || entries.length > MAX_LIST_ENTRIES) return undefined
    const normalizedEntries: Array<{ path: string; type: 'file'; size: number }> = []
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') return undefined
      const typed = entry as Record<string, unknown>
      if (
        !hasExactKeys(typed, ['path', 'type', 'size']) ||
        typeof typed.path !== 'string' ||
        typed.type !== 'file' ||
        typeof typed.size !== 'number' ||
        !Number.isSafeInteger(typed.size) ||
        typed.size < 0
      ) return undefined
      let normalizedPath: string
      try { normalizedPath = normalizeRelativePath(typed.path) } catch { return undefined }
      const extension = normalizedPath.slice(normalizedPath.lastIndexOf('.')).toLowerCase()
      if (!TEXT_EXTENSIONS.has(extension) && !IMAGE_EXTENSIONS.has(extension)) return undefined
      normalizedEntries.push({ path: normalizedPath, type: 'file', size: typed.size })
    }
    blocks[0] = { type: 'text', text: JSON.stringify(normalizedEntries, null, 2) }
  }
  return { blocks }
}

const isRelayUnavailable = (
  value: unknown,
  operation: RelayOperation,
  relativePath: string | null,
): boolean => {
  if (!value || typeof value !== 'object') return false
  const envelope = value as Record<string, unknown>
  return hasExactKeys(envelope, ['operation', 'relativePath', 'error']) &&
    envelope.operation === operation &&
    envelope.relativePath === relativePath &&
    envelope.error === 'unavailable'
}

export async function requestDesktopResult({
  userId,
  familyId,
  authorizationEpoch,
  runId,
  operation,
  relativePath,
}: {
  userId: string
  familyId: string
  authorizationEpoch: number
  runId: string
  operation: RelayOperation
  relativePath?: string
}): Promise<RelayResult> {
  const normalizedRelativePath = operation === 'read'
    ? normalizeRelativePath(relativePath || '')
    : null
  const now = new Date()
  const [user, grant] = await Promise.all([
    User.findById(userId)
      .select('mcpEnabled mcpResultsEnabled mcpAuthorizationEpoch')
      .lean(),
    McpGrant.exists({
      userId,
      familyId,
      authorizationEpoch,
      revokedAt: { $exists: false },
      refreshExpiresAt: { $gt: now },
      familyExpiresAt: { $gt: now },
      scopes: 'neuroflame:results',
    }),
  ])
  if (
    !user?.mcpEnabled ||
    !user.mcpResultsEnabled ||
    (user.mcpAuthorizationEpoch ?? 0) !== authorizationEpoch ||
    !grant
  ) {
    throw new Error('MCP derivative result access is disabled')
  }
  const run = await Run.findById(runId).select('consortium members').lean()
  if (!run || !run.members.some((member) => member.toString() === userId)) {
    throw new Error('Run not found or not accessible')
  }
  const familyPending = Array.from(pending.values())
    .filter((relay) => relay.familyId === familyId).length
  const userPending = Array.from(pending.values())
    .filter((relay) => relay.userId === userId).length
  if (
    pending.size >= MAX_PENDING_GLOBAL ||
    familyPending >= MAX_PENDING_PER_FAMILY ||
    userPending >= MAX_PENDING_PER_USER ||
    !relayRateLimiter.allow(userId, familyId)
  ) throw new Error('Too many derivative result requests')

  const requestId = randomUUID()
  const callbackToken = randomBytes(32).toString('base64url')
  const expiresAt = Date.now() + RELAY_TIMEOUT_MS
  const resultPromise = new Promise<RelayResult>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(requestId)
      reject(new Error('The desktop derivative result service is unavailable'))
    }, RELAY_TIMEOUT_MS)
    pending.set(requestId, {
      userId,
      familyId,
      authorizationEpoch,
      runId,
      consortiumId: run.consortium.toString(),
      operation,
      relativePath: normalizedRelativePath,
      tokenHash: hashToken(callbackToken),
      expiresAt,
      resolve,
      reject,
      timer,
    })
  })
  // A settings change can reject the relay while publication is still
  // yielding; attach a handler immediately while preserving the rejected
  // promise returned to the tool caller.
  resultPromise.catch(() => undefined)

  const mcpUrl = new URL(MCP_PUBLIC_URL)
  const callbackUrl = new URL(`/mcp-relay/${requestId}`, mcpUrl.origin).toString()
  try {
    await pubsub.publish('MCP_RESULT_REQUEST', {
      requestId,
      targetUserId: userId,
      consortiumId: run.consortium.toString(),
      runId,
      operation,
      relativePath: normalizedRelativePath,
      callbackUrl,
      callbackToken,
      expiresAt: expiresAt.toString(),
    })
  } catch (error) {
    const relay = pending.get(requestId)
    if (relay) clearTimeout(relay.timer)
    pending.delete(requestId)
    throw error
  }
  return resultPromise
}

export function createMcpRelayRouter(): Router {
  const router = Router()
  router.post('/mcp-relay/:requestId', json({ limit: '17mb' }), async (req, res) => {
    const requestId = req.params.requestId
    const relay = pending.get(requestId)
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '') || ''
    if (!relay || relay.expiresAt < Date.now()) {
      res.status(410).json({ error: 'Relay request expired' })
      return
    }
    if (!relayTokenMatches(bearer, relay.tokenHash)) {
      res.status(401).json({ error: 'Invalid relay token' })
      return
    }
    try {
      const [user, grant, run] = await Promise.all([
        User.findById(relay.userId)
          .select('mcpEnabled mcpResultsEnabled mcpAuthorizationEpoch')
          .lean(),
        McpGrant.exists({
          userId: relay.userId,
          familyId: relay.familyId,
          authorizationEpoch: relay.authorizationEpoch,
          revokedAt: { $exists: false },
          refreshExpiresAt: { $gt: new Date() },
          familyExpiresAt: { $gt: new Date() },
          scopes: 'neuroflame:results',
        }),
        Run.findById(relay.runId).select('consortium members').lean(),
      ])
      if (
        !user?.mcpEnabled ||
        !user.mcpResultsEnabled ||
        (user.mcpAuthorizationEpoch ?? 0) !== relay.authorizationEpoch ||
        !grant ||
        !run ||
        run.consortium.toString() !== relay.consortiumId ||
        !run.members.some((member) => member.toString() === relay.userId)
      ) {
        clearTimeout(relay.timer)
        pending.delete(requestId)
        relay.reject(new Error('MCP derivative result authorization expired'))
        res.status(403).json({ error: 'Relay authorization expired' })
        return
      }
      if (isRelayUnavailable(req.body, relay.operation, relay.relativePath)) {
        clearTimeout(relay.timer)
        pending.delete(requestId)
        relay.reject(new Error('The requested derivative result is unavailable'))
        res.status(202).json({ accepted: true })
        return
      }
      const normalized = normalizeRelayResponse(
        req.body,
        relay.operation,
        relay.relativePath,
      )
      if (!normalized) {
        res.status(422).json({ error: 'Invalid relay response' })
        return
      }
      clearTimeout(relay.timer)
      pending.delete(requestId)
      relay.resolve(normalized)
      logger.info('MCP desktop derivative result relay completed', {
        requestId,
        userId: relay.userId,
        blockCount: normalized.blocks.length,
      })
      res.status(202).json({ accepted: true })
    } catch {
      res.status(503).json({ error: 'Relay authorization could not be verified' })
    }
  })
  return router
}
