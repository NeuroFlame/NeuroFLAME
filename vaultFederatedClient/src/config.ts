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
  const value = process.env[name]
  if (value) {
    // eslint-disable-next-line no-console
    console.log(`[CONFIG] Loaded optional environment variable: ${name}`)
  }
  return value
}

const resolveContainerService = (): 'docker' | 'singularity' => {
  const raw = process.env.VAULT_CONTAINER_SERVICE
  if (!raw) {
    return 'docker'
  }
  const normalized = raw.trim().toLowerCase()
  if (normalized === 'docker') {
    return 'docker'
  }
  if (normalized === 'singularity') {
    return 'singularity'
  }
  // eslint-disable-next-line no-console
  console.error(
    `[CONFIG] Invalid VAULT_CONTAINER_SERVICE="${raw}". Expected docker|singularity.`,
  )
  process.exit(1)
}

export const VAULT_HTTP_URL = requireEnv('VAULT_HTTP_URL')
export const VAULT_WS_URL = requireEnv('VAULT_WS_URL')
export const VAULT_ACCESS_TOKEN = requireEnv('VAULT_ACCESS_TOKEN')
export const VAULT_BASE_DIR = requireEnv('VAULT_BASE_DIR')
export const VAULT_DATASET_DIR = requireEnv('VAULT_DATASET_DIR')
export const VAULT_LOG_PATH = requireEnvOptional('VAULT_LOG_PATH')
export const VAULT_CONTAINER_SERVICE = resolveContainerService()
