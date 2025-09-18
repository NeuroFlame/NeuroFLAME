import { Request, Response, NextFunction } from 'express'

const isCentralUser = (req: Request, res: Response, next: NextFunction) => {
  const tokenPayload = res.locals.tokenPayload
  if (tokenPayload?.roles?.includes('central')) {
    next()
  } else {
    res.status(403).send('Unauthorized: Only central user can upload files.')
  }
}

export default isCentralUser
