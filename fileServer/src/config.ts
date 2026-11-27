const requireEnv = (name: string): string => {
  const value = process.env[name]
  if (!value) {
    console.error(`[CONFIG] Missing required environment variable: ${name}`)
    process.exit(1)
  }
  return value
}

const requireEnvOptional = (name: string): string | undefined => process.env[name]

const positiveNumber = (name: string, fallback: number): number => {
  const value = Number(process.env[name] ?? fallback)
  if (!Number.isFinite(value) || value <= 0) {
    console.error(`[CONFIG] ${name} must be a positive number`)
    process.exit(1)
  }
  return value
}

export const AUTHENTICATION_URL = requireEnv('AUTHENTICATION_URL')
export const BASE_DIR = requireEnv('FILE_SERVER_BASE_DIR')
export const PORT = Number(requireEnv('FILE_SERVER_PORT'))
export const LOG_PATH = requireEnvOptional('LOG_PATH')
// Participant kits hold NVFlare private keys; they are only needed while a run starts.
export const RUN_KIT_RETENTION_HOURS = positiveNumber('RUN_KIT_RETENTION_HOURS', 24)
