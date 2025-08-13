import { app } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import { logger } from './logger.js'
import { getConfig, saveConfig } from './config.js'
import { Config } from './types.js'

async function initializeConfig(): Promise<Config> {
  const config = (await getConfig()) as Config
  const defaultAppLogPath = path.join(app.getPath('userData'), 'logs')
  const defaultEdgeClientBasePath = path.join(app.getPath('userData'), 'base')

  const finalConfig = {
    ...config,
    logPath: config.logPath || defaultAppLogPath,
    edgeClientConfig: {
      ...config.edgeClientConfig,
      logPath:
        config.edgeClientConfig.logPath ||
        path.join(config.logPath || defaultAppLogPath, 'edgeClient'),
      path_base_directory:
        config.edgeClientConfig.path_base_directory ||
        defaultEdgeClientBasePath,
    },
  }

  // Ensure all paths exist
  await ensurePathsExist([
    finalConfig.logPath,
    finalConfig.edgeClientConfig.logPath,
    finalConfig.edgeClientConfig.path_base_directory,
  ])

  // Save the updated config
  await saveConfig(JSON.stringify(finalConfig))

  return finalConfig
}

// Ensure paths exist
async function ensurePathsExist(paths: string[]): Promise<void> {
  try {
    await Promise.all(
      paths.map(async (dirPath) => {
        await fs.mkdir(dirPath, { recursive: true })
        logger.info(`Directory ensured: ${dirPath}`)
      }),
    )
  } catch (error) {
    logger.error(
      `Error ensuring directories exist: ${
        error instanceof Error ? error.message : error
      }`,
    )
    throw new Error(paths.toString()) // Re-throw to propagate the error outward
  }
}

export default initializeConfig
