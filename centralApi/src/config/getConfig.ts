import fs from 'fs/promises'
import defaultConfig from './defaultConfig.js'
import { logger } from '../logger.js'

interface CentralApiConfig {
  fileServerUrl: string
  apolloPort: number
  databaseDetails: {
    url: string
    user: string
    pass: string
  },
  logPath?: string
}

export default async function getConfig(): Promise<CentralApiConfig> {
  const configPath = getConfigPath()

  if (configPath) {
    // logger.info(`Attempting to load config from: ${configPath}`)
    try {
      const config = await loadConfigFromFile(configPath)
      // logger.info(`Loaded configuration from: ${configPath}`)
      return config
    } catch (error) {
      logger.error(`Failed to load config from ${configPath}:`, error)
    }
  }

  logger.info('Loading default configuration.')
  return defaultConfig
}

function getConfigPath(): string | undefined {
  return getConfigPathFromArgs() || getConfigPathFromEnv()
}

function getConfigPathFromArgs(): string | undefined {
  const arg = process.argv.find((arg) => arg.startsWith('--config='))
  return arg ? arg.split('=')[1] : undefined
}

function getConfigPathFromEnv(): string | undefined {
  const envPath = process.env.COINSTAC_CONFIGURATIONS_FOLDER
  return envPath ? `${envPath}/centralApiConfig.json` : undefined
}

async function loadConfigFromFile(
  path: string,
): Promise<CentralApiConfig> {
  const data = await fs.readFile(path, 'utf8')
  return JSON.parse(data)
}
