import { Request, Response, NextFunction } from 'express'
import axios from 'axios'
import { AUTHENTICATION_URL } from '../config.js'
import { logger } from '../logger.js'

const decodeAndValidateJWT = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const token = req.headers['x-access-token'] as string | undefined
  if (!token) return res.status(401).send('Access token is required')

  try {
    const response = await axios.post(AUTHENTICATION_URL, { token })
    if (response.status === 200 && response.data?.decodedAccessToken) {
      const decoded = response.data.decodedAccessToken

      // Make decoded token available in BOTH places:
      //  - res.locals.tokenPayload: used by existing middleware (e.g. isCentralUser)
      //  - req.decodedToken: used by some routes
      res.locals.tokenPayload = decoded
      ;(req as any).decodedToken = decoded
      next()
    } else {
      res.status(401).send('Invalid token')
    }
  } catch (error) {
    logger.error('Authentication error:', error)
    res.status(500).send('Authentication service error')
  }
}

export default decodeAndValidateJWT
