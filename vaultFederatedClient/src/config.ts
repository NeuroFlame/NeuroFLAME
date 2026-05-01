import path from 'path'

const requireEnv = (name: string): string => {
  const value = process.env[name]
  if (!value) {
    console.error(`[CONFIG] Missing required environment variable: ${name}`)
    process.exit(1)
  }
  return value
}

const requireEnvOptional = (name: string): string | undefined => {
  const value = process.env[name]
  if (value) {
    console.log(`[CONFIG] Loaded optional environment variable: ${name}`)
  }
  return value
}

const requireAbsoluteEnvPath = (name: string): string =>
  path.resolve(requireEnv(name))

const requireAbsoluteEnvOptionalPath = (name: string): string | undefined => {
  const value = requireEnvOptional(name)
  return value ? path.resolve(value) : undefined
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

  console.error(
    `[CONFIG] Invalid VAULT_CONTAINER_SERVICE="${raw}". Expected docker|singularity.`,
  )
  process.exit(1)
}

export const VAULT_HTTP_URL = requireEnv('VAULT_HTTP_URL')
export const VAULT_WS_URL = requireEnv('VAULT_WS_URL')
export const VAULT_ACCESS_TOKEN = requireEnv('VAULT_ACCESS_TOKEN')
export const VAULT_BASE_DIR = requireAbsoluteEnvPath('VAULT_BASE_DIR')
export const VAULT_DATASET_DIR = requireAbsoluteEnvPath('VAULT_DATASET_DIR')
export const VAULT_LOG_PATH = requireAbsoluteEnvOptionalPath('VAULT_LOG_PATH')
export const VAULT_CONTAINER_SERVICE = resolveContainerService()
