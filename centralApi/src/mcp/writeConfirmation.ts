import { createHash, randomUUID } from 'crypto'
import { ElicitResultSchema } from '@modelcontextprotocol/sdk/types.js'
import McpGrant from '../database/models/McpGrant.js'
import McpWriteRequest from '../database/models/McpWriteRequest.js'
import User from '../database/models/User.js'

type ToolExtra = { sendRequest: Function; signal?: AbortSignal }

const WRITE_CONFIRMATION_LIFETIME_MS = 2 * 60 * 1000
const MAX_PENDING_WRITES_PER_USER = 10
const POLL_INTERVAL_MS = 500
const CLIENT_NOTICE_WAIT_MS = 1_000
const MAX_PREVIEW_VALUE_CHARACTERS = 2_000
const EXCLUDED_PREVIEW_KEYS = /(?:password|secret|token)$/i

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)]),
    )
  }
  return value
}

export function writeOperationHash(toolName: string, args: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify({ toolName, args: stableValue(args) }))
    .digest('hex')
}

export interface WritePreviewField {
  label: string
  value: string
  fullValue?: string
}

const previewValue = (value: unknown): Pick<WritePreviewField, 'value' | 'fullValue'> => {
  const serialized = typeof value === 'string'
    ? value
    : JSON.stringify(stableValue(value), null, 2)
  if (serialized.length <= MAX_PREVIEW_VALUE_CHARACTERS) return { value: serialized }
  const digest = createHash('sha256').update(serialized).digest('hex')
  return {
    value: `${serialized.slice(0, MAX_PREVIEW_VALUE_CHARACTERS)}\n` +
      `[truncated preview: ${serialized.length} characters; full-value SHA-256: ${digest}]`,
    fullValue: serialized,
  }
}

export function buildWritePreview(
  toolName: string,
  args: unknown,
): WritePreviewField[] {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return []
  const values: Record<string, unknown> = { ...(args as Record<string, unknown>) }
  if (toolName === 'create_consortium') {
    if (!Object.hasOwn(values, 'description')) values.description = '(not provided)'
    if (!Object.hasOwn(values, 'isPrivate')) values.isPrivate = false
  }
  return Object.entries(values)
    .filter(([key]) => !EXCLUDED_PREVIEW_KEYS.test(key))
    .map(([label, value]) => ({ label, ...previewValue(value) }))
}

const delay = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

export async function authorizeWrite(
  extra: ToolExtra,
  summary: string,
  awaitInAppApproval: () => Promise<boolean>,
): Promise<boolean> {
  const notice = Promise.resolve()
    .then(() => extra.sendRequest({
      method: 'elicitation/create',
      params: {
        mode: 'form',
        message: `${summary} Open NeuroFLAME User Settings to approve this operation. ` +
          'This client response does not authorize the change.',
        requestedSchema: {
          type: 'object',
          properties: {
            acknowledged: {
              type: 'boolean',
              title: 'Open NeuroFLAME to approve',
              default: false,
            },
          },
        },
      },
    }, ElicitResultSchema))
    .catch(() => undefined)
  await Promise.race([notice, delay(CLIENT_NOTICE_WAIT_MS)])
  if (extra.signal?.aborted) return false
  const approved = await awaitInAppApproval()
  return approved && !extra.signal?.aborted
}

export async function requestWriteApproval({
  userId,
  familyId,
  clientName,
  authorizationEpoch,
  toolName,
  args,
  summary,
  preview,
  signal,
}: {
  userId: string
  familyId: string
  clientName: string
  authorizationEpoch: number
  toolName: string
  args: unknown
  summary: string
  preview: WritePreviewField[]
  signal?: AbortSignal
}): Promise<boolean> {
  const now = new Date()
  const [user, grant, pendingCount] = await Promise.all([
    User.findById(userId).select('mcpEnabled mcpAuthorizationEpoch').lean(),
    McpGrant.exists({
      userId,
      familyId,
      authorizationEpoch,
      revokedAt: { $exists: false },
      refreshExpiresAt: { $gt: now },
      familyExpiresAt: { $gt: now },
      scopes: 'neuroflame:write',
    }),
    McpWriteRequest.countDocuments({
      userId,
      status: { $in: ['pending', 'approved'] },
      expiresAt: { $gt: now },
    }),
  ])
  if (
    !user?.mcpEnabled ||
    (user.mcpAuthorizationEpoch ?? 0) !== authorizationEpoch ||
    !grant ||
    pendingCount >= MAX_PENDING_WRITES_PER_USER
  ) return false

  const requestId = randomUUID()
  const operationHash = writeOperationHash(toolName, args)
  const expiresAt = new Date(Date.now() + WRITE_CONFIRMATION_LIFETIME_MS)
  await McpWriteRequest.create({
    requestId,
    userId,
    familyId,
    clientName,
    authorizationEpoch,
    toolName,
    operationHash,
    summary,
    preview,
    status: 'pending',
    expiresAt,
  })

  while (Date.now() < expiresAt.getTime()) {
    if (signal?.aborted) {
      await McpWriteRequest.updateOne(
        { requestId, status: { $in: ['pending', 'approved'] } },
        { $set: { status: 'denied', decidedAt: new Date() } },
      )
      return false
    }
    const request = await McpWriteRequest.findOne({ requestId }).lean()
    if (!request || request.status === 'denied') return false
    if (request.status === 'approved') {
      const [currentUser, currentGrant] = await Promise.all([
        User.findById(userId).select('mcpEnabled mcpAuthorizationEpoch').lean(),
        McpGrant.exists({
          userId,
          familyId,
          authorizationEpoch,
          revokedAt: { $exists: false },
          refreshExpiresAt: { $gt: new Date() },
          familyExpiresAt: { $gt: new Date() },
          scopes: 'neuroflame:write',
        }),
      ])
      if (
        !currentUser?.mcpEnabled ||
        (currentUser.mcpAuthorizationEpoch ?? 0) !== authorizationEpoch ||
        !currentGrant
      ) return false
      const consumed = await McpWriteRequest.findOneAndUpdate(
        {
          requestId,
          userId,
          familyId,
          authorizationEpoch,
          operationHash,
          status: 'approved',
          expiresAt: { $gt: new Date() },
        },
        { $set: { status: 'consumed' } },
      )
      return Boolean(consumed)
    }
    await delay(POLL_INTERVAL_MS)
  }
  await McpWriteRequest.updateOne(
    { requestId, status: 'pending' },
    { $set: { status: 'denied', decidedAt: new Date() } },
  )
  return false
}

export async function cancelPendingWritesForUser(userId: string): Promise<void> {
  await McpWriteRequest.updateMany(
    { userId, status: { $in: ['pending', 'approved'] } },
    { $set: { status: 'denied', decidedAt: new Date() } },
  )
}

export async function cancelPendingWritesForFamily(familyId: string): Promise<void> {
  await McpWriteRequest.updateMany(
    { familyId, status: { $in: ['pending', 'approved'] } },
    { $set: { status: 'denied', decidedAt: new Date() } },
  )
}
