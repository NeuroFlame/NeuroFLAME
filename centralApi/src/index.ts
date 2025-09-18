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
import mongoose from 'mongoose'
import { logger, logToPath } from './logger.js'

import { typeDefs } from './graphql/generated/typeDefs.js'
import resolvers from './graphql/resolvers.js'

import { httpServerContext, wsServerContext } from './serverContexts.js'
import { validateAccessToken } from './authentication/authentication.js'

import getConfig from './config/getConfig.js'

const config = await getConfig()
if (config.logPath) {
  logToPath(config.logPath)
}

export async function start({
  port,
  databaseDetails,
}: {
  port: number
  databaseDetails: {
    url: string
    user: string
    pass: string
  }
  logPath?: string
}) {
  const { url, user, pass } = databaseDetails

  await mongoose.connect(url, {
    autoIndex: false,
    user,
    pass,
    authSource: 'admin',
  })

  const PORT = port
  // Create schema, which will be used separately by ApolloServer and
  // the WebSocket server.
  const schema = makeExecutableSchema({ typeDefs, resolvers })

  // Create an Express app and HTTP server; we will attach the WebSocket
  // server and the ApolloServer to this HTTP server.
  const app = express()
  const httpServer = createServer(app)

  // Set up WebSocket server.
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

  // Set up ApolloServer.
  const server = new ApolloServer({
    schema,
    plugins: [
      // Proper shutdown for the HTTP server.
      ApolloServerPluginDrainHttpServer({ httpServer }),

      // Proper shutdown for the WebSocket server.
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

  app.post('/authenticateToken', (req, res) => {
    const token = req.body.token // assuming the token is sent in the request body
    if (!token) {
      res.status(400).send('Token is required')
      return
    }

    try {
      const decodedAccessToken = validateAccessToken(token)
      if (decodedAccessToken) {
        res.status(200).json({ decodedAccessToken })
      } else {
        res.status(401).send('Token is invalid')
      }
    } catch (e) {
      res.status(401).send('Failed to decode token') // More specific error message
    }
  })

  // Now that our HTTP server is fully set up, actually listen.
  httpServer.listen(PORT, () => {
    logger.info(`🚀 Query endpoint ready at http://localhost:${PORT}/graphql`)
    logger.info(
      `🚀 Subscription endpoint ready at ws://localhost:${PORT}/graphql`,
    )
  })
}

start({
  port: config.apolloPort,
  databaseDetails: config.databaseDetails,
}).catch(logger.error) // Proper error handling
