// Environment-variable configuration for standalone (headless) startup —
// mirrors vaultFederatedClient/src/config.ts's pattern exactly. This is
// distinct from config/config.ts, which just holds whatever config object
// it's given (the desktop app builds one from its own config.json and
// calls setConfig() directly, never touching env vars at all). This module
// is the *other* way to arrive at that same shape: read it from the
// environment, for when nothing is embedding/launching this process.

import path from 'path'
import { edgeClientLaunchConfiguration } from './config/config.js'

export const REQUIRED_ENV = [
  'EDGE_HTTP_URL',
  'EDGE_WS_URL',
  'EDGE_BASE_DIR',
  'EDGE_HOSTING_PORT',
]

export const OPTIONAL_ENV = [
  'EDGE_AUTHENTICATION_ENDPOINT',
  'EDGE_LOG_PATH',
  'EDGE_CONTAINER_SERVICE',
]

const requireEnv = (name: string): string => {
  const value = process.env[name]
  if (!value) {
    console.error(`[CONFIG] Missing required environment variable: ${name}`)
    process.exit(1)
  }
  return value
}

const optionalEnv = (name: string): string | undefined => process.env[name]

const requireAbsolutePath = (name: string): string => path.resolve(requireEnv(name))

const resolveContainerService = (): string => {
  const raw = process.env.EDGE_CONTAINER_SERVICE
  if (!raw) {
    return 'docker'
  }
  const normalized = raw.trim().toLowerCase()
  if (normalized === 'docker' || normalized === 'singularity') {
    return normalized
  }
  console.error(
    `[CONFIG] Invalid EDGE_CONTAINER_SERVICE="${raw}". Expected docker|singularity.`,
  )
  process.exit(1)
}

const resolveHostingPort = (): number => {
  const raw = requireEnv('EDGE_HOSTING_PORT')
  const port = Number(raw)
  if (!Number.isInteger(port) || port <= 0) {
    console.error(`[CONFIG] Invalid EDGE_HOSTING_PORT="${raw}". Expected a positive integer.`)
    process.exit(1)
  }
  return port
}

// Every real config we've seen (configs/electronApp1.json) colocates this
// with the GraphQL endpoint's origin — same fallback-with-override pattern
// used for the CLI's own edge-results/edge-ws URL derivation.
const resolveAuthenticationEndpoint = (httpUrl: string): string => {
  const explicit = optionalEnv('EDGE_AUTHENTICATION_ENDPOINT')
  if (explicit) return explicit
  return httpUrl.replace(/\/graphql\/?$/, '/authenticateToken')
}

export function loadConfigFromEnv(): edgeClientLaunchConfiguration {
  const httpUrl = requireEnv('EDGE_HTTP_URL')
  return {
    httpUrl,
    wsUrl: requireEnv('EDGE_WS_URL'),
    pathBaseDirectory: requireAbsolutePath('EDGE_BASE_DIR'),
    authenticationEndpoint: resolveAuthenticationEndpoint(httpUrl),
    hostingPort: resolveHostingPort(),
    logPath: optionalEnv('EDGE_LOG_PATH'),
    containerService: resolveContainerService(),
  }
}

export function validateEnv(): string[] {
  const errors = REQUIRED_ENV
    .filter((name) => !process.env[name])
    .map((name) => `Missing ${name}`)

  const containerService = process.env.EDGE_CONTAINER_SERVICE
  if (
    containerService &&
    !['docker', 'singularity'].includes(containerService.trim().toLowerCase())
  ) {
    errors.push('EDGE_CONTAINER_SERVICE must be docker or singularity')
  }

  const hostingPort = process.env.EDGE_HOSTING_PORT
  if (hostingPort && (!Number.isInteger(Number(hostingPort)) || Number(hostingPort) <= 0)) {
    errors.push('EDGE_HOSTING_PORT must be a positive integer')
  }

  return errors
}
