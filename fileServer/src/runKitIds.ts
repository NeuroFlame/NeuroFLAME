import { Request, Response, NextFunction } from 'express'

// Consortium, run and participant IDs are MongoDB ObjectIds. Accept nothing else
// before joining them into file server paths.
const OBJECT_ID = /^[a-f0-9]{24}$/i

export const isObjectId = (value: unknown): value is string =>
  typeof value === 'string' && OBJECT_ID.test(value)

export const requireObjectIdParams = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!Object.values(req.params).every(isObjectId)) {
    res.status(400).send('Invalid run path')
    return
  }
  next()
}
