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

export const CLIENT_FILE_SERVER_URL = 'http://192.168.66.1:3002'; //requireEnv('CLIENT_FILE_SERVER_URL')
export const APOLLO_PORT = Number(requireEnv('APOLLO_PORT'))
export const DATABASE_URI = requireEnv('DATABASE_URI')
export const LOG_PATH = requireEnvOptional('LOG_PATH')
export const RESEND_API_KEY = requireEnv('RESEND_API_KEY')
export const COINSTAC_CONFIGURATIONS_FOLDER = requireEnvOptional(
  'COINSTAC_CONFIGURATIONS_FOLDER',
)
export const ACCESS_TOKEN_SECRET = requireEnv('ACCESS_TOKEN_SECRET')
export const ACCESS_TOKEN_DURATION = requireEnv('ACCESS_TOKEN_DURATION')
