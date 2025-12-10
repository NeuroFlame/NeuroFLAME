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

export const AUTHENTICATION_URL = requireEnv('AUTHENTICATION_URL')
export const BASE_DIR = requireEnv('FILE_SERVER_BASE_DIR')
export const PORT = Number(requireEnv('FILE_SERVER_PORT'))
export const LOG_PATH = requireEnvOptional('LOG_PATH')
