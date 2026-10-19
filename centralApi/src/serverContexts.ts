import { validateAccessToken } from './authentication/authentication.js'
import { IncomingHttpHeaders } from 'http'
import User from './database/models/User.js'
import { getClientAddress, ClientAddressRequest } from './authentication/clientAddress.js'

export interface ServerContext {
  userId?: string
  roles?: string[]
  error?: string
  tokenVersion?: number
  clientAddress?: string
}

interface WebSocketContext {
  extra?: { request: ClientAddressRequest }
  connectionParams: {
    accessToken: string
  }
}

interface HttpRequest extends ClientAddressRequest {
  headers: IncomingHttpHeaders
}

interface HttpResponse {}

interface HttpContext {
  req: HttpRequest
  res: HttpResponse
}

export const validateServerAccessToken = async (accessToken: string): Promise<ServerContext> => {
  const context = validateAccessToken(accessToken)
  if (!context.userId) {
    return { ...context }
  }

  const user = await User.findById(context.userId)
    .select('roles tokenVersion')
    .lean()
    .exec()
  if (!user || (context.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
    throw new Error('Access token has been revoked')
  }

  return { ...context, roles: user.roles }
}

const wsServerContext = async (
  ctx: WebSocketContext,
  msg: any,
  args: any,
): Promise<ServerContext> => {
  try {
    const { accessToken } = ctx.connectionParams
    return { ...await validateServerAccessToken(accessToken), clientAddress: getClientAddress(ctx.extra?.request) }
  } catch (e) {
    return {
      error: (e as Error).message,
      clientAddress: getClientAddress(ctx.extra?.request),
    }
  }
}

const httpServerContext = async ({
  req,
  res,
}: HttpContext): Promise<ServerContext> => {
  try {
    const accessToken =
      (Array.isArray(req.headers['x-access-token'])
        ? req.headers['x-access-token'][0]
        : req.headers['x-access-token']
      )?.replace(/^null$/, '') || ''
    return { ...await validateServerAccessToken(accessToken), clientAddress: getClientAddress(req) }
  } catch (e) {
    return {
      error: (e as Error).message,
      clientAddress: getClientAddress(req),
    }
  }
}

export { wsServerContext, httpServerContext }
