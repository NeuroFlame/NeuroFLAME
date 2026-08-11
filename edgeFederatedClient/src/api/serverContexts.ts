import { validateToken } from '../auth/validateToken.js'
import { Kind, parse } from 'graphql'

// WebSocket server context
export const wsServerContext = async (ctx: any) => {
  const { accessToken } = ctx.connectionParams
  const tokenPayload = await validateToken(accessToken)
  const context = tokenPayload
  return context
}

type BaseContext = {
  accessToken?: string
  tokenPayload?: TokenPayload
}

type TokenPayload = {
  userId?: string
  roles?: string[]
}

const isDisconnectOnlyRequest = (body: unknown): boolean => {
  if (!body || typeof body !== 'object') return false
  const query = (body as { query?: unknown }).query
  if (typeof query !== 'string') return false
  try {
    const document = parse(query)
    if (document.definitions.length !== 1) return false
    const operation = document.definitions[0]
    return operation.kind === Kind.OPERATION_DEFINITION &&
      operation.operation === 'mutation' &&
      operation.selectionSet.selections.length === 1 &&
      operation.selectionSet.selections[0].kind === Kind.FIELD &&
      operation.selectionSet.selections[0].name.value === 'disconnectAsUser'
  } catch {
    return false
  }
}

export const httpServerContext = async ({
  req,
  res,
}: {
  req: any
  res: any
}): Promise<BaseContext> => {
  const accessToken = req.headers['x-access-token']?.replace(/^null$/, '')
  if (isDisconnectOnlyRequest(req.body)) return { accessToken }
  const tokenPayload = await validateToken(accessToken)
  return {
    accessToken,
    tokenPayload,
  }
}
