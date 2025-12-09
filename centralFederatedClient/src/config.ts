const requireEnv = (name: string): string => {
  const value = process.env[name]
  if (!value) {
    // eslint-disable-next-line no-console
    console.error(`[CONFIG] Missing required environment variable: ${name}`)
    process.exit(1)
  }
  return value
}

const requireEnvOptional = (name: string): string | undefined => {
  return process.env[name]
}

export const HTTP_URL = requireEnv('HTTP_URL')
export const WS_URL = requireEnv('WS_URL')
export const ACCESS_TOKEN = requireEnv('ACCESS_TOKEN')
export const FILE_SERVER_URL = requireEnv('FILE_SERVER_URL')
export const BASE_DIR = requireEnv('CENTRAL_BASE_DIR')
export const FQDN = requireEnv('FQDN')
export const LOG_PATH = requireEnvOptional('LOG_PATH')
export const HOSTING_PORT_START = Number(requireEnv('HOSTING_PORT_START'))
export const HOSTING_PORT_END = Number(requireEnv('HOSTING_PORT_END'))
