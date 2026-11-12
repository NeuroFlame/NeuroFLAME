import { ApolloServer } from '@apollo/server'
import { expressMiddleware } from '@as-integrations/express4'
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer'
import express from 'express'
import { createServer, IncomingMessage, Server } from 'http'
import { makeExecutableSchema } from '@graphql-tools/schema'
import { WebSocketServer } from 'ws'
import { useServer } from 'graphql-ws/lib/use/ws'
import bodyParser from 'body-parser'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { logger } from '../logger.js'
import runResultsRoute from './routes/runResultsRoutes.js'
import {
  hasLocalApiKey,
  LOCAL_API_HOST,
  requireLocalApiKey,
} from './localApiAccess.js'

import { typeDefs } from './graphql/typeDefs.js'
import { resolvers } from './graphql/resolvers.js'
import { httpServerContext, wsServerContext } from './serverContexts.js'

export async function start({
  port,
  localApiKey,
}: {
  port: number
  localApiKey: string
}): Promise<Server> {
  const PORT = port

  const schema = makeExecutableSchema({ typeDefs, resolvers })

  const app = express()
  const httpServer = createServer(app)

  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql',
    verifyClient: ({ req }: { req: IncomingMessage }) => hasLocalApiKey(req.headers, localApiKey),
  })

  const serverCleanup = useServer(
    {
      schema,
      context: wsServerContext,
    },
    wsServer,
  )

  const server = new ApolloServer({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose()
            },
          }
        },
      },
    ],
  })

  await server.start()

  app.use(cors())
  app.use(requireLocalApiKey(localApiKey))
  app.use(bodyParser.json())
  app.use(
    '/graphql',
    expressMiddleware(server, {
      context: httpServerContext,
    }),
  )

  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const staticDir = path.resolve(__dirname, '../../static')

  // NiiVue viewer and its bundled assets
  app.use('/static', express.static(staticDir))
  app.get('/nii-viewer', (_req, res) => res.sendFile(path.join(staticDir, 'nii-viewer.html')))

  // Results are served only from run results directories, never the whole base directory.
  app.use('/run-results', runResultsRoute)

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject)
    httpServer.listen(PORT, LOCAL_API_HOST, () => {
      httpServer.off('error', reject)
      resolve()
    })
  })
  logger.info(`🚀 Query endpoint ready at http://${LOCAL_API_HOST}:${PORT}/graphql`)
  logger.info(`🚀 Subscription endpoint ready at ws://${LOCAL_API_HOST}:${PORT}/graphql`)
  return httpServer
}
