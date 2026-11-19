import express from 'express'
import downloadRoute from './routes/downloadRoute.js'
import uploadRoute from './routes/uploadRoute.js'

export const createApp = () => {
  const app = express()
  app.use(express.json())
  app.use('/', downloadRoute)
  app.use('/', uploadRoute)
  return app
}
