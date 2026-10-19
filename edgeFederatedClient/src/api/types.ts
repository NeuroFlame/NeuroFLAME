import { TokenPayload } from '../auth/validateToken.js'

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload
    }
  }
}

export type RunResultsParams = {
  consortiumId: string
  runId: string
  participantId?: string
  splat?: string[]
}
