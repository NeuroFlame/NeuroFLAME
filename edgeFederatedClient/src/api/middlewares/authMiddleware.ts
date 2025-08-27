import { Request, Response, NextFunction } from 'express'
import { validateToken, TokenPayload } from '../../auth/validateToken.js'
import { logger } from '../../logger.js'

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accessToken = req.headers['x-access-token'] as string || req.query['x-access-token'] as string
    if (!accessToken) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' })
    }

    const tokenPayload: TokenPayload | null = await validateToken(accessToken)
    if (!tokenPayload) {
      return res.status(403).json({ error: 'Forbidden: Invalid token' })
    }

    (req as any).user = tokenPayload

    next()
  } catch (error) {
    logger.error('Authentication error:', error)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}
