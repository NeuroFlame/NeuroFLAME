import { GraphQLError, GraphQLSchema } from 'graphql'
import { Context, ServerOptions } from 'graphql-ws'
import { Extra } from 'graphql-ws/lib/use/ws'
import { WebSocket } from 'ws'
import { validateServerAccessToken, wsServerContext } from '../serverContexts.js'
import { onSessionRevocation } from './sessionRevocation.js'

const sessionError = (): GraphQLError => new GraphQLError('Session expired. Please sign in again.', {
  extensions: { code: 'UNAUTHENTICATED' },
})

export const createSessionWebSocketOptions = (schema: GraphQLSchema) => {
  const connections = new Map<WebSocket, { userId: string; tokenVersion: number }>()
  const close = (socket: WebSocket): void => {
    if (socket.readyState === WebSocket.OPEN) socket.close(4403, 'Session expired. Please sign in again.')
  }
  const authenticate = async (ctx: Context<Record<string, unknown>, Extra>): Promise<void> => {
    const token = ctx.connectionParams?.accessToken
    if (typeof token !== 'string') throw sessionError()
    const user = await validateServerAccessToken(token)
    if (!user.userId) throw sessionError()
    connections.set(ctx.extra.socket, { userId: user.userId, tokenVersion: user.tokenVersion ?? 0 })
  }
  const unsubscribe = onSessionRevocation((userId, tokenVersion) => {
    for (const [socket, session] of connections) {
      if (session.userId === userId && session.tokenVersion < tokenVersion) close(socket)
    }
  })
  const options: ServerOptions<Record<string, unknown>, Extra> = {
    schema,
    context: wsServerContext,
    onConnect: async (ctx) => {
      try {
        await authenticate(ctx)
        return true
      } catch {
        return false
      }
    },
    onSubscribe: async (ctx) => {
      try {
        await authenticate(ctx)
      } catch {
        close(ctx.extra.socket)
        return [sessionError()]
      }
    },
    onNext: async (ctx) => {
      try {
        // Subscription contexts are cached; recheck before sending any result.
        await authenticate(ctx)
      } catch {
        close(ctx.extra.socket)
        return { errors: [sessionError()] }
      }
    },
    onClose: (ctx) => { connections.delete(ctx.extra.socket) },
  }
  return {
    options,
    dispose: (): void => {
      unsubscribe()
      connections.clear()
    },
  }
}
