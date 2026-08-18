import { createHash, randomBytes, randomUUID } from 'crypto'
import type { Response } from 'express'
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js'
import type {
  AuthorizationParams,
  OAuthServerProvider,
} from '@modelcontextprotocol/sdk/server/auth/provider.js'
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import type {
  OAuthClientInformationFull,
  OAuthTokenRevocationRequest,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js'
import { compare } from '../authentication/authentication.js'
import { MCP_PUBLIC_URL } from '../config.js'
import McpAuthorizationCode from '../database/models/McpAuthorizationCode.js'
import McpAuthorizationRequest from '../database/models/McpAuthorizationRequest.js'
import McpClient from '../database/models/McpClient.js'
import McpGrant from '../database/models/McpGrant.js'
import User from '../database/models/User.js'
import {
  authorizationAttemptLimiter,
  AuthorizationRateLimitError,
} from './authorizationRateLimit.js'
import { cancelPendingResultsForFamily } from './resultRelay.js'
import { closeMcpSessionsForFamily } from './sessionRegistry.js'

const ACCESS_TOKEN_LIFETIME_SECONDS = 15 * 60
const REFRESH_TOKEN_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000
const MAX_REFRESH_ROTATIONS = 10_000
const AUTHORIZATION_CODE_LIFETIME_MS = 5 * 60 * 1000
const AUTHORIZATION_REQUEST_ATTEMPTS = 5
export function authorizationCspForRedirect(redirectUri: string): string {
  const redirect = new URL(redirectUri)
  if (!['http:', 'https:'].includes(redirect.protocol)) {
    throw new Error('OAuth redirect URI must use HTTP(S)')
  }
  return [
    "default-src 'none'",
    "style-src 'unsafe-inline'",
    `form-action 'self' ${redirect.origin}`,
    "frame-ancestors 'none'",
    "base-uri 'none'",
  ].join('; ')
}
const ALLOWED_SCOPES = new Set([
  'neuroflame:read',
  'neuroflame:write',
  'neuroflame:results',
])

const tokenHash = (value: string): string =>
  createHash('sha256').update(value).digest('hex')

const randomToken = (): string => randomBytes(32).toString('base64url')

const invalidateFamilyRuntime = async (familyId: string): Promise<void> => {
  cancelPendingResultsForFamily(familyId)
  await closeMcpSessionsForFamily(familyId)
}

const escapeHtml = (value: string): string => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;')

export function normalizeRequestedScopes(scopes?: string[]): string[] {
  const requested = scopes?.length ? scopes : ['neuroflame:read']
  if (requested.some((scope) => !ALLOWED_SCOPES.has(scope))) {
    throw new Error('Invalid OAuth scope')
  }
  return [...new Set(requested)]
}

class MongoMcpClientsStore implements OAuthRegisteredClientsStore {
  async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
    const client = await McpClient.findOne({ clientId }).lean()
    if (!client) return undefined
    return {
      client_id: client.clientId,
      client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
      token_endpoint_auth_method: client.tokenEndpointAuthMethod,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    }
  }

  async registerClient(
    client: Omit<OAuthClientInformationFull, 'client_id' | 'client_id_issued_at'>,
  ): Promise<OAuthClientInformationFull> {
    if (!Array.isArray(client.redirect_uris) || client.redirect_uris.length === 0) {
      throw new Error('At least one redirect URI is required')
    }
    for (const redirectUri of client.redirect_uris) {
      const parsed = new URL(redirectUri)
      const loopback = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost'
      if (
        (parsed.protocol !== 'https:' && !(loopback && parsed.protocol === 'http:')) ||
        parsed.username ||
        parsed.password ||
        parsed.hash
      ) {
        throw new Error('Redirect URIs must use HTTPS or a loopback address')
      }
    }
    const clientId = randomToken()
    const created = await McpClient.create({
      clientId,
      clientName: client.client_name?.trim().slice(0, 100) || 'MCP client',
      redirectUris: client.redirect_uris,
      tokenEndpointAuthMethod: 'none',
    })
    return {
      ...client,
      client_id: clientId,
      client_id_issued_at: Math.floor(created.createdAt.getTime() / 1000),
      client_name: created.clientName,
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    }
  }
}

export class NeuroflameOAuthProvider implements OAuthServerProvider {
  readonly clientsStore = new MongoMcpClientsStore()

  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response,
  ): Promise<void> {
    if (!client.redirect_uris.includes(params.redirectUri)) {
      throw new Error('Unregistered redirect URI')
    }
    const resource = params.resource?.toString() || MCP_PUBLIC_URL
    if (resource !== MCP_PUBLIC_URL) throw new Error('Invalid resource')
    const scopes = normalizeRequestedScopes(params.scopes)
    const requestToken = randomToken()
    await McpAuthorizationRequest.create({
      requestHash: tokenHash(requestToken),
      clientId: client.client_id,
      clientName: client.client_name || 'MCP client',
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      scopes,
      resource,
      state: params.state,
      attemptsRemaining: AUTHORIZATION_REQUEST_ATTEMPTS,
      expiresAt: new Date(Date.now() + AUTHORIZATION_CODE_LIFETIME_MS),
    })
    res.set({
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
      'Content-Security-Policy': authorizationCspForRedirect(params.redirectUri),
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    })
    res.type('html').send(`<!doctype html>
      <html><head><meta charset="utf-8"><title>Authorize NeuroFLAME MCP</title>
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <style>body{font:16px system-ui;max-width:560px;margin:3rem auto;padding:0 1rem}label{display:block;margin-top:1rem}input{width:100%;padding:.6rem;box-sizing:border-box}button{margin-top:1.5rem;padding:.7rem 1rem;background:#001f70;color:white;border:0;border-radius:4px}.warning{background:#fff4ce;padding:1rem;border-radius:4px}</style></head>
      <body><h1>Authorize ${escapeHtml(client.client_name || 'MCP client')}</h1>
      <p>This agent client is requesting access to your NeuroFLAME account.</p>
      <div class="warning">MCP must first be enabled in NeuroFLAME User Settings. Derivative Results-page access is controlled by a separate setting.</div>
      <p>Requested permissions: ${escapeHtml(scopes.join(', '))}</p>
      <form method="post" action="/oauth/approve">
        <input type="hidden" name="request" value="${escapeHtml(requestToken)}">
        <label>Username or email<input name="username" autocomplete="username" required></label>
        <label>Password<input name="password" type="password" autocomplete="current-password" required></label>
        <button type="submit">Authorize</button>
      </form></body></html>`)
  }

  async completeAuthorization(
    request: string,
    username: string,
    password: string,
    remoteAddress: string,
  ): Promise<string> {
    const authorizationRequest = await McpAuthorizationRequest.findOneAndUpdate(
      {
        requestHash: tokenHash(request),
        consumedAt: { $exists: false },
        attemptsRemaining: { $gt: 0 },
        expiresAt: { $gt: new Date() },
      },
      { $inc: { attemptsRemaining: -1 } },
    )
    if (!authorizationRequest) throw new Error('Invalid authorization request')
    if (!authorizationAttemptLimiter.allow(remoteAddress, username)) {
      throw new AuthorizationRateLimitError('Too many authorization attempts')
    }
    const client = await this.clientsStore.getClient(authorizationRequest.clientId)
    if (!client || !client.redirect_uris.includes(authorizationRequest.redirectUri)) {
      throw new Error('Unknown OAuth client')
    }
    const user = await User.findOne({ username })
    if (!user || !(await compare(password, user.hash))) {
      throw new Error('Invalid username or password')
    }
    if (!user.mcpEnabled) throw new Error('MCP is disabled for this account')
    const consumed = await McpAuthorizationRequest.findOneAndUpdate(
      { _id: authorizationRequest._id, consumedAt: { $exists: false } },
      { $set: { consumedAt: new Date() } },
    )
    if (!consumed) throw new Error('Authorization request already used')

    const code = randomToken()
    await McpAuthorizationCode.create({
      codeHash: tokenHash(code),
      clientId: authorizationRequest.clientId,
      userId: user._id,
      redirectUri: authorizationRequest.redirectUri,
      codeChallenge: authorizationRequest.codeChallenge,
      scopes: authorizationRequest.scopes,
      resource: authorizationRequest.resource,
      authorizationEpoch: user.mcpAuthorizationEpoch ?? 0,
      expiresAt: new Date(Date.now() + AUTHORIZATION_CODE_LIFETIME_MS),
    })
    const redirect = new URL(authorizationRequest.redirectUri)
    redirect.searchParams.set('code', code)
    if (authorizationRequest.state) redirect.searchParams.set('state', authorizationRequest.state)
    return redirect.toString()
  }

  async challengeForAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
  ): Promise<string> {
    const code = await McpAuthorizationCode.findOne({
      codeHash: tokenHash(authorizationCode),
      clientId: client.client_id,
      expiresAt: { $gt: new Date() },
    }).lean()
    if (!code) throw new Error('Invalid or expired authorization code')
    return code.codeChallenge
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    redirectUri?: string,
    resource?: URL,
  ): Promise<OAuthTokens> {
    const code = await McpAuthorizationCode.findOneAndDelete({
      codeHash: tokenHash(authorizationCode),
      clientId: client.client_id,
      expiresAt: { $gt: new Date() },
    })
    if (!code || code.redirectUri !== redirectUri) throw new Error('Invalid authorization code')
    if ((resource?.toString() || code.resource) !== code.resource) throw new Error('Invalid resource')
    const user = await User.findById(code.userId).select('mcpEnabled mcpAuthorizationEpoch')
    if (
      !user?.mcpEnabled ||
      (user.mcpAuthorizationEpoch ?? 0) !== code.authorizationEpoch
    ) throw new Error('MCP authorization has expired')
    return this.issueTokens({
      userId: code.userId,
      client,
      scopes: code.scopes,
      resource: code.resource,
      authorizationEpoch: code.authorizationEpoch,
    })
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    scopes?: string[],
    resource?: URL,
  ): Promise<OAuthTokens> {
    const refreshTokenHash = tokenHash(refreshToken)
    const nowDate = new Date()
    const grant = await McpGrant.findOne({
      refreshTokenHash,
      clientId: client.client_id,
      revokedAt: { $exists: false },
      refreshExpiresAt: { $gt: nowDate },
      familyExpiresAt: { $gt: nowDate },
    })
    if (!grant) {
      await this.revokeReplayedRefreshToken(client.client_id, refreshTokenHash)
      throw new Error('Invalid refresh token')
    }
    if (grant.refreshRotationCount >= MAX_REFRESH_ROTATIONS) {
      await McpGrant.updateOne(
        { _id: grant._id, revokedAt: { $exists: false } },
        { $set: { revokedAt: new Date() } },
      )
      await invalidateFamilyRuntime(grant.familyId)
      throw new Error('Refresh-token family rotation limit reached')
    }
    const user = await User.findById(grant.userId).select('mcpEnabled mcpAuthorizationEpoch')
    if (
      !user?.mcpEnabled ||
      (user.mcpAuthorizationEpoch ?? 0) !== grant.authorizationEpoch
    ) throw new Error('MCP authorization has expired')
    if (resource && resource.toString() !== grant.resource) throw new Error('Invalid resource')
    if (scopes?.some((scope) => !grant.scopes.includes(scope))) {
      throw new Error('Invalid OAuth scope')
    }
    const nextScopes = scopes?.length ? scopes : grant.scopes
    const accessToken = randomToken()
    const nextRefreshToken = randomToken()
    const now = Date.now()
    const familyExpiresAt = grant.familyExpiresAt.getTime()
    const accessExpiresAt = new Date(Math.min(
      now + ACCESS_TOKEN_LIFETIME_SECONDS * 1000,
      familyExpiresAt,
    ))
    const refreshExpiresAt = new Date(Math.min(
      now + REFRESH_TOKEN_LIFETIME_MS,
      familyExpiresAt,
    ))
    const rotated = await McpGrant.findOneAndUpdate(
      {
        _id: grant._id,
        clientId: client.client_id,
        refreshTokenHash,
        authorizationEpoch: grant.authorizationEpoch,
        refreshRotationCount: { $lt: MAX_REFRESH_ROTATIONS },
        revokedAt: { $exists: false },
        refreshExpiresAt: { $gt: new Date() },
        familyExpiresAt: { $gt: new Date() },
      },
      {
        $set: {
          accessTokenHash: tokenHash(accessToken),
          refreshTokenHash: tokenHash(nextRefreshToken),
          scopes: nextScopes,
          accessExpiresAt,
          refreshExpiresAt,
          lastUsedAt: new Date(now),
        },
        $push: { spentRefreshTokenHashes: refreshTokenHash },
        $inc: { refreshRotationCount: 1 },
      },
      { new: true },
    )
    if (!rotated) {
      await this.revokeReplayedRefreshToken(client.client_id, refreshTokenHash)
      throw new Error('Invalid refresh token')
    }
    const currentUser = await User.findById(grant.userId)
      .select('mcpEnabled mcpAuthorizationEpoch')
      .lean()
    if (
      !currentUser?.mcpEnabled ||
      (currentUser.mcpAuthorizationEpoch ?? 0) !== grant.authorizationEpoch
    ) {
      await McpGrant.updateOne({ _id: grant._id }, { $set: { revokedAt: new Date() } })
      await invalidateFamilyRuntime(grant.familyId)
      throw new Error('MCP authorization has expired')
    }
    const removedScopes = grant.scopes.filter((scope) => !nextScopes.includes(scope))
    if (removedScopes.includes('neuroflame:results')) {
      cancelPendingResultsForFamily(grant.familyId)
    }
    if (removedScopes.length > 0) await closeMcpSessionsForFamily(grant.familyId)
    return {
      access_token: accessToken,
      refresh_token: nextRefreshToken,
      token_type: 'bearer',
      expires_in: Math.max(1, Math.floor((accessExpiresAt.getTime() - now) / 1000)),
      scope: nextScopes.join(' '),
    }
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const grant = await McpGrant.findOne({
      accessTokenHash: tokenHash(token),
      revokedAt: { $exists: false },
      accessExpiresAt: { $gt: new Date() },
      familyExpiresAt: { $gt: new Date() },
    })
    if (!grant) throw new Error('Invalid or expired access token')
    const user = await User.findById(grant.userId).select('mcpEnabled mcpAuthorizationEpoch')
    if (
      !user?.mcpEnabled ||
      (user.mcpAuthorizationEpoch ?? 0) !== grant.authorizationEpoch
    ) throw new Error('MCP authorization has expired')
    await McpGrant.updateOne(
      { _id: grant._id, revokedAt: { $exists: false } },
      { $set: { lastUsedAt: new Date() } },
    )
    return {
      token,
      clientId: grant.clientId,
      scopes: grant.scopes,
      expiresAt: Math.floor(grant.accessExpiresAt.getTime() / 1000),
      resource: new URL(grant.resource),
      extra: {
        userId: grant.userId.toString(),
        grantId: grant._id.toString(),
        familyId: grant.familyId,
        authorizationEpoch: grant.authorizationEpoch,
      },
    }
  }

  async revokeToken(
    client: OAuthClientInformationFull,
    request: OAuthTokenRevocationRequest,
  ): Promise<void> {
    const hash = tokenHash(request.token)
    const grants = await McpGrant.find({
      clientId: client.client_id,
      $or: [
        { accessTokenHash: hash },
        { refreshTokenHash: hash },
        { spentRefreshTokenHashes: hash },
      ],
    }).select('familyId').lean()
    const familyIds = grants.map((grant) => grant.familyId)
    if (familyIds.length === 0) return
    await McpGrant.updateMany(
      {
        clientId: client.client_id,
        familyId: { $in: familyIds },
      },
      { $set: { revokedAt: new Date() } },
    )
    await Promise.all(grants.map(async (grant) => {
      await invalidateFamilyRuntime(grant.familyId)
    }))
  }

  private async revokeReplayedRefreshToken(
    clientId: string,
    replayedHash: string,
  ): Promise<void> {
    const replayed = await McpGrant.findOneAndUpdate(
      {
        clientId,
        spentRefreshTokenHashes: replayedHash,
        revokedAt: { $exists: false },
        familyExpiresAt: { $gt: new Date() },
      },
      { $set: { revokedAt: new Date() } },
      { new: true },
    )
    if (replayed) await invalidateFamilyRuntime(replayed.familyId)
  }

  private async issueTokens({
    userId,
    client,
    scopes,
    resource,
    authorizationEpoch,
  }: {
    userId: unknown
    client: OAuthClientInformationFull
    scopes: string[]
    resource: string
    authorizationEpoch: number
  }): Promise<OAuthTokens> {
    const accessToken = randomToken()
    const refreshToken = randomToken()
    const now = Date.now()
    const familyExpiresAt = new Date(now + REFRESH_TOKEN_LIFETIME_MS)
    await McpGrant.create({
      userId,
      familyId: randomUUID(),
      clientId: client.client_id,
      clientName: client.client_name || 'MCP client',
      accessTokenHash: tokenHash(accessToken),
      refreshTokenHash: tokenHash(refreshToken),
      spentRefreshTokenHashes: [],
      refreshRotationCount: 0,
      scopes,
      resource,
      authorizationEpoch,
      accessExpiresAt: new Date(now + ACCESS_TOKEN_LIFETIME_SECONDS * 1000),
      refreshExpiresAt: new Date(now + REFRESH_TOKEN_LIFETIME_MS),
      familyExpiresAt,
    })
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'bearer',
      expires_in: ACCESS_TOKEN_LIFETIME_SECONDS,
      scope: scopes.join(' '),
    }
  }
}
