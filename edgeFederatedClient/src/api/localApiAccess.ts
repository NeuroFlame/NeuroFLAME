import { createHash, timingSafeEqual } from 'crypto'
import type { IncomingHttpHeaders } from 'http'
import type { NextFunction, Request, Response } from 'express'

// The desktop host attaches this header to requests from its own window only.
// Other machines, local users and browsers never learn the per-launch key.
export const LOCAL_API_KEY_HEADER = 'x-neuroflame-local-key'
export const LOCAL_API_HOST = '127.0.0.1'
const MIN_LOCAL_API_KEY_LENGTH = 32

export const assertLocalApiKey = (localApiKey: unknown): string => {
  if (typeof localApiKey !== 'string' || localApiKey.length < MIN_LOCAL_API_KEY_LENGTH) {
    throw new Error(
      `Edge client requires a local API key of at least ${MIN_LOCAL_API_KEY_LENGTH} characters`,
    )
  }
  return localApiKey
}

const digest = (value: string): Buffer => createHash('sha256').update(value).digest()

export const hasLocalApiKey = (
  headers: IncomingHttpHeaders,
  localApiKey: string,
): boolean => {
  const supplied = headers[LOCAL_API_KEY_HEADER]
  return typeof supplied === 'string' &&
    timingSafeEqual(digest(supplied), digest(localApiKey))
}

export const requireLocalApiKey = (localApiKey: string) => (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (!hasLocalApiKey(req.headers, localApiKey)) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }
  next()
}
