import { validateAccessToken } from './authentication/authentication.js'
import { IncomingHttpHeaders } from 'http'

interface ServerContext {
  userId?: string
  roles?: string[]
  error?: string
}

interface WebSocketContext {
  connectionParams: {
    accessToken: string
  }
}

interface HttpRequest {
  headers: IncomingHttpHeaders
}

interface HttpResponse {}

interface HttpContext {
  req: HttpRequest
  res: HttpResponse
}

const wsServerContext = (ctx: WebSocketContext, msg: any, args: any): ServerContext => {
  try {
    const { accessToken } = ctx.connectionParams
    const context = { ...(validateAccessToken(accessToken) as object) };
    return context
  } catch (e) {
    return {
      error: (e as Error).message,
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
    const context = { ...(validateAccessToken(accessToken) as object) };
    return context
  } catch (e) {
    return {
      error: (e as Error).message,
    }
  }
}

export { wsServerContext, httpServerContext }
