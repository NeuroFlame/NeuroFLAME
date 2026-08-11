import McpAuthorizationCode from '../database/models/McpAuthorizationCode.js'
import McpGrant from '../database/models/McpGrant.js'
import McpWriteRequest from '../database/models/McpWriteRequest.js'
import User from '../database/models/User.js'
import { MCP_PUBLIC_URL } from '../config.js'
import {
  cancelPendingResultsForFamily,
  cancelPendingResultsForUser,
} from './resultRelay.js'
import {
  cancelPendingWritesForFamily,
  cancelPendingWritesForUser,
} from './writeConfirmation.js'
import {
  closeMcpSessionsForFamily,
  closeMcpSessionsForUser,
} from './sessionRegistry.js'

export interface McpSettingsView {
  enabled: boolean
  resultsEnabled: boolean
  endpoint: string
  connections: Array<{
    id: string
    clientName: string
    createdAt: string
    lastUsedAt: string
  }>
  pendingWrites: Array<{
    id: string
    clientName: string
    toolName: string
    summary: string
    operationHash: string
    preview: Array<{ label: string; value: string; fullValue?: string }>
    createdAt: string
    expiresAt: string
  }>
}

export async function getMcpSettings(userId: string): Promise<McpSettingsView> {
  const user = await User.findById(userId).select('mcpEnabled mcpResultsEnabled')
  if (!user) throw new Error('User not found')

  const grants = await McpGrant.find({
    userId,
    revokedAt: { $exists: false },
    refreshExpiresAt: { $gt: new Date() },
    familyExpiresAt: { $gt: new Date() },
  })
    .select('familyId clientName createdAt lastUsedAt')
    .sort({ lastUsedAt: -1 })
    .lean()

  const pendingWrites = await McpWriteRequest.find({
    userId,
    status: 'pending',
    expiresAt: { $gt: new Date() },
  })
    .select('requestId clientName toolName summary operationHash preview createdAt expiresAt')
    .sort({ createdAt: 1 })
    .lean()

  return {
    enabled: user.mcpEnabled ?? false,
    resultsEnabled: (user.mcpEnabled && user.mcpResultsEnabled) ?? false,
    endpoint: MCP_PUBLIC_URL,
    connections: grants.map((grant) => ({
      id: grant.familyId,
      clientName: grant.clientName,
      createdAt: grant.createdAt.toISOString(),
      lastUsedAt: grant.lastUsedAt.toISOString(),
    })),
    pendingWrites: pendingWrites.map((request) => ({
      id: request.requestId,
      clientName: request.clientName,
      toolName: request.toolName,
      summary: request.summary,
      operationHash: request.operationHash,
      preview: request.preview || [],
      createdAt: request.createdAt.toISOString(),
      expiresAt: request.expiresAt.toISOString(),
    })),
  }
}

export async function setMcpEnabled(
  userId: string,
  enabled: boolean,
): Promise<McpSettingsView> {
  const update = enabled
    ? { $set: { mcpEnabled: true } }
    : {
        $set: { mcpEnabled: false, mcpResultsEnabled: false },
        $inc: { mcpAuthorizationEpoch: 1 },
      }
  const user = await User.findByIdAndUpdate(userId, update)
  if (!user) throw new Error('User not found')

  if (!enabled) {
    cancelPendingResultsForUser(userId)
    await Promise.all([
      cancelPendingWritesForUser(userId),
      closeMcpSessionsForUser(userId),
      McpGrant.updateMany(
        { userId, revokedAt: { $exists: false } },
        { $set: { revokedAt: new Date() } },
      ),
      McpAuthorizationCode.deleteMany({ userId }),
    ])
  }
  return getMcpSettings(userId)
}

export async function setMcpResultsEnabled(
  userId: string,
  enabled: boolean,
): Promise<McpSettingsView> {
  const user = enabled
    ? await User.findOneAndUpdate(
      { _id: userId, mcpEnabled: true },
      { $set: { mcpResultsEnabled: true } },
    )
    : await User.findByIdAndUpdate(
      userId,
      { $set: { mcpResultsEnabled: false } },
    )
  if (!user) {
    if (!(await User.exists({ _id: userId }))) throw new Error('User not found')
    throw new Error('Enable MCP before enabling derivative result access')
  }
  if (!enabled) cancelPendingResultsForUser(userId)
  return getMcpSettings(userId)
}

export async function revokeMcpConnection(
  userId: string,
  connectionId: string,
): Promise<boolean> {
  const result = await McpGrant.updateOne(
    { familyId: connectionId, userId, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
  )
  if (result.modifiedCount === 1) {
    cancelPendingResultsForFamily(connectionId)
    await Promise.all([
      cancelPendingWritesForFamily(connectionId),
      closeMcpSessionsForFamily(connectionId),
    ])
  }
  return result.modifiedCount === 1
}

export async function decideMcpWrite(
  userId: string,
  requestId: string,
  approved: boolean,
): Promise<boolean> {
  const user = await User.findById(userId)
    .select('mcpEnabled mcpAuthorizationEpoch')
    .lean()
  if (!user?.mcpEnabled) return false
  const request = await McpWriteRequest.findOne({
    requestId,
    userId,
    status: 'pending',
    expiresAt: { $gt: new Date() },
  }).lean()
  if (!request || request.authorizationEpoch !== (user.mcpAuthorizationEpoch ?? 0)) return false
  if (approved && !(await McpGrant.exists({
    userId,
    familyId: request.familyId,
    authorizationEpoch: request.authorizationEpoch,
    revokedAt: { $exists: false },
    refreshExpiresAt: { $gt: new Date() },
    familyExpiresAt: { $gt: new Date() },
    scopes: 'neuroflame:write',
  }))) return false
  const result = await McpWriteRequest.updateOne(
    { _id: request._id, status: 'pending' },
    { $set: { status: approved ? 'approved' : 'denied', decidedAt: new Date() } },
  )
  return result.modifiedCount === 1
}
