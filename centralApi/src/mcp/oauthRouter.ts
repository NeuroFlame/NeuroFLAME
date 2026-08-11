import express, { Router } from 'express'
import {
  createOAuthMetadata,
  mcpAuthRouter,
} from '@modelcontextprotocol/sdk/server/auth/router.js'
import { MCP_PUBLIC_URL } from '../config.js'
import { logger } from '../logger.js'
import { AuthorizationRateLimitError } from './authorizationRateLimit.js'
import { NeuroflameOAuthProvider } from './oauthProvider.js'

export const oauthProvider = new NeuroflameOAuthProvider()

export function createMcpOAuthRouter(): Router {
  const mcpUrl = new URL(MCP_PUBLIC_URL)
  const issuerUrl = new URL(mcpUrl.origin)
  const router = Router()

  router.use(express.urlencoded({ extended: false, limit: '16kb' }))
  router.post('/oauth/approve', async (req, res) => {
    try {
      const request = typeof req.body.request === 'string' ? req.body.request : ''
      const username = typeof req.body.username === 'string' ? req.body.username : ''
      const password = typeof req.body.password === 'string' ? req.body.password : ''
      const redirect = await oauthProvider.completeAuthorization(
        request,
        username,
        password,
        req.ip || req.socket.remoteAddress || 'unknown',
      )
      res.set('Cache-Control', 'no-store')
      res.redirect(redirect)
    } catch (error) {
      logger.warn('MCP authorization was rejected')
      res.set({
        'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
        'Referrer-Policy': 'no-referrer',
      })
      res.status(error instanceof AuthorizationRateLimitError ? 429 : 400).type('html').send(
        '<h1>Authorization failed</h1>' +
        '<p>Check your credentials and confirm MCP is enabled in NeuroFLAME User Settings.</p>',
      )
    }
  })

  router.use(mcpAuthRouter({
    provider: oauthProvider,
    issuerUrl,
    resourceServerUrl: mcpUrl,
    resourceName: 'NeuroFLAME',
    scopesSupported: [
      'neuroflame:read',
      'neuroflame:write',
      'neuroflame:results',
    ],
  }))
  return router
}

export const oauthMetadata = createOAuthMetadata({
  provider: oauthProvider,
  issuerUrl: new URL(new URL(MCP_PUBLIC_URL).origin),
  scopesSupported: [
    'neuroflame:read',
    'neuroflame:write',
    'neuroflame:results',
  ],
})
