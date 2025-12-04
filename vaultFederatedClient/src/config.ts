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

export const VAULT_HTTP_URL = process.env.VAULT_HTTP_URL || ''
export const VAULT_WS_URL = process.env.VAULT_WS_URL || ''
export const VAULT_ACCESS_TOKEN = process.env.VAULT_ACCESS_TOKEN || ''
export const VAULT_FILE_SERVER_URL = process.env.VAULT_FILE_SERVER_URL || ''
export const VAULT_BASE_IDR = process.env.VAULT_BASE_IDR || ''
export const VAULT_DATASET_DIR = process.env.VAULT_DATASET_DIR || ''
export const VAULT_LOG_PATH = process.env.VAULT_LOG_PATH || ''
