import { isIP } from 'net'

const requireEnv = (name: string): string => {
  const value = process.env[name]
  if (!value) {
    console.error(`[CONFIG] Missing required environment variable: ${name}`)
    process.exit(1)
  }
  return value
}

const requireEnvOptional = (name: string): string | undefined => process.env[name]

export const CLIENT_FILE_SERVER_URL = requireEnv('CLIENT_FILE_SERVER_URL')
export const APOLLO_PORT = Number(requireEnv('APOLLO_PORT'))
export const DATABASE_URI = requireEnv('DATABASE_URI')
export const LOG_PATH = requireEnvOptional('LOG_PATH')
export const RESEND_API_KEY = requireEnv('RESEND_API_KEY')
export const COINSTAC_CONFIGURATIONS_FOLDER = requireEnvOptional(
  'COINSTAC_CONFIGURATIONS_FOLDER',
)
export const ACCESS_TOKEN_SECRET = requireEnv('ACCESS_TOKEN_SECRET')
export const ACCESS_TOKEN_DURATION = requireEnv('ACCESS_TOKEN_DURATION')
export const CONSORTIUM_INVITE_URL = requireEnv('CONSORTIUM_INVITE_URL')

const configuredMcpUrl = requireEnvOptional('MCP_PUBLIC_URL') ||
  `http://localhost:${APOLLO_PORT}/mcp`
const parsedMcpUrl = new URL(configuredMcpUrl)
if (
  !['http:', 'https:'].includes(parsedMcpUrl.protocol) ||
  parsedMcpUrl.pathname !== '/mcp' ||
  parsedMcpUrl.search ||
  parsedMcpUrl.hash ||
  parsedMcpUrl.username ||
  parsedMcpUrl.password
) {
  throw new Error('MCP_PUBLIC_URL must be an absolute HTTP(S) URL ending in /mcp')
}
export const MCP_PUBLIC_URL = parsedMcpUrl.toString()
export const MCP_ALLOWED_ORIGINS = (requireEnvOptional('MCP_ALLOWED_ORIGINS') || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

export function parseMcpTrustProxy(value?: string): number | string[] | undefined {
  const configured = value?.trim()
  if (!configured) return undefined
  if (/^\d+$/.test(configured)) {
    const hops = Number(configured)
    if (!Number.isSafeInteger(hops) || hops < 1 || hops > 5) {
      throw new Error('MCP_TRUST_PROXY hop count must be between 1 and 5')
    }
    return hops
  }
  const networks = configured.split(',').map((entry) => entry.trim())
  if (networks.some((entry) => !entry)) throw new Error('Invalid MCP_TRUST_PROXY CIDR list')
  for (const network of networks) {
    const parts = network.split('/')
    const version = isIP(parts[0])
    const prefix = parts.length === 2 ? Number(parts[1]) : Number.NaN
    const maximum = version === 4 ? 32 : version === 6 ? 128 : 0
    if (
      parts.length !== 2 ||
      maximum === 0 ||
      !Number.isInteger(prefix) ||
      prefix < 1 ||
      prefix > maximum
    ) throw new Error('MCP_TRUST_PROXY must contain only bounded IP CIDRs')
  }
  return networks
}

export const MCP_TRUST_PROXY = parseMcpTrustProxy(requireEnvOptional('MCP_TRUST_PROXY'))
