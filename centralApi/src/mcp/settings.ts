import McpAuthorizationCode from '../database/models/McpAuthorizationCode.js'
import McpGrant from '../database/models/McpGrant.js'
import User from '../database/models/User.js'
import { MCP_PUBLIC_URL } from '../config.js'
import {
  cancelPendingResultsForFamily,
  cancelPendingResultsForUser,
} from './resultRelay.js'
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
    await closeMcpSessionsForFamily(connectionId)
  }
  return result.modifiedCount === 1
}
