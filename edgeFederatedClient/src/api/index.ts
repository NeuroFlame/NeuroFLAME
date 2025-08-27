import { ApolloServer } from '@apollo/server'
import { expressMiddleware } from '@apollo/server/express4'
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer'
import express from 'express'
import { createServer } from 'http'
import { makeExecutableSchema } from '@graphql-tools/schema'
import { WebSocketServer } from 'ws'
import { useServer } from 'graphql-ws/lib/use/ws'
import bodyParser from 'body-parser'
import cors from 'cors'
import path from 'path'
import { logger } from '../logger.js'
import runResultsRoute from './routes/runResultsRoutes.js'

import { typeDefs } from './graphql/typeDefs.js'
import { resolvers } from './graphql/resolvers.js'
import { httpServerContext, wsServerContext } from './serverContexts.js'

import { getConfig } from '../config/config.js'

export async function start({ port }: { port: number }) {
  const PORT = port

  const config = await getConfig()

  if (!config) {
    throw new Error('getConfig() returned undefined')
  }

  const { path_base_directory: filesDirectory } = config

  const schema = makeExecutableSchema({ typeDefs, resolvers })

  const app = express()
  const httpServer = createServer(app)

  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql',
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
  app.use(bodyParser.json())
  app.use(
    '/graphql',
    expressMiddleware(server, {
      context: httpServerContext,
    }),
  )

  logger.info('[STATIC FILES] Serving from: ' + path.resolve(filesDirectory))

  // Serve static assets (excluding .html)
  app.use('/run-results', (req, res, next) => {
    if (req.path.endsWith('.html')) {
      return next()
    }
    express.static(path.resolve(filesDirectory))(req, res, next)
  })

  // Dynamic API routes for /run-results/*
  app.use('/run-results', runResultsRoute)

  httpServer.listen(PORT, () => {
    logger.info(`🚀 Query endpoint ready at http://localhost:${PORT}/graphql`)
    logger.info(`🚀 Subscription endpoint ready at ws://localhost:${PORT}/graphql`)
  })
}
