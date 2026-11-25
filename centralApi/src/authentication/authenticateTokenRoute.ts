import { Request, Response } from 'express'
import { validateServerAccessToken } from '../serverContexts.js'

// Used by the file server and edge clients. Applies the same revocation check
// as the GraphQL API, so a revoked account token is refused here too.
export const authenticateToken = async (req: Request, res: Response) => {
  const token = req.body?.token
  if (typeof token !== 'string' || !token) {
    res.status(400).send('Token is required')
    return
  }

  try {
    const decodedAccessToken = await validateServerAccessToken(token)
    res.status(200).json({ decodedAccessToken })
  } catch {
    res.status(401).send('Token is invalid')
  }
}
