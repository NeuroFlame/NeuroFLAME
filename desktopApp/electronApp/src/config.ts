import path from 'path'
import { promises as fs } from 'fs'
import { app, shell } from 'electron'
import { defaultConfig, testConfig } from './defaultConfig.js'
import { Config } from './types.js'
import { logger } from './logger.js'

export function getConfigPath(): string {
  const args: string[] = process.argv.slice(1)
  const configArgIndex: number = args.findIndex((arg) =>
    arg.startsWith('--config='),
  )
  return configArgIndex !== -1
    ? path.resolve(args[configArgIndex].split('=')[1])
    : path.join(app.getPath('userData'), 'config.json')
}

export async function getConfig(): Promise<Config> {
  if (process.env.NODE_ENV === "test") {
    return testConfig
  }

  const configPath = getConfigPath()
  logger.info(`Reading configuration from: ${configPath}`)
  try {
    const config = await fs.readFile(configPath, 'utf8')
    return JSON.parse(config) as Config
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      logger.info(
        'Configuration file not found, creating default configuration.',
      )
      await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2))
      return defaultConfig
    } else {
      logger.error(
        `Failed to read or parse the configuration file: ${
          (error as Error).message
        }`,
      )
      throw new Error('Failed to access the configuration file.')
    }
  }
}

export async function saveConfig(configString: string): Promise<void> {
  const configPath = getConfigPath()
  try {
    // Attempt to parse the JSON to ensure it's valid
    const parsedConfig = JSON.parse(configString)

    // Write directly to file, allowing any JSON structure
    await fs.writeFile(configPath, JSON.stringify(parsedConfig, null, 2))
    logger.info('Configuration successfully saved.')
  } catch (error) {
    logger.error(`Failed to save configuration: ${(error as Error).message}`)
    throw new Error(
      'Failed to save configuration. Please ensure it is valid JSON.',
    )
  }
}

export async function applyDefaultConfig(): Promise<void> {
  const configPath = getConfigPath()
  await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2))
}

export async function openConfig(): Promise<void> {
  const configPath = getConfigPath()
  try {
    await shell.openPath(configPath)
  } catch (e) {
    logger.error(`Failed to open path: ${e}`)
    throw new Error('Failed to open path')
  }
}
