import * as runCoordinator from '../../runCoordinator/runCoordinator.js'
import { getConfig } from '../../config/config.js'
import path from 'path'
import fs from 'fs/promises'
import { logger } from '../../logger.js'
import inMemoryStore from '../../inMemoryStore.js'

export const resolvers = {
  Query: {
    getMountDir: async (
      _: any,
      { consortiumId }: { consortiumId: string },
      context: any,
    ): Promise<string> => {
      // Check if the caller is authorized
      const { tokenPayload } = context
      const { userId } = tokenPayload
      if (!tokenPayload || !userId) {
        throw new Error('Not authorized')
      }

      const { pathBaseDirectory } = getConfig()
      const consortiumDir = path.join(pathBaseDirectory, consortiumId)

      try {
        // Read the mount_config.json file
        const configPath = path.join(consortiumDir, 'mount_config.json')
        const configFile = await fs.readFile(configPath, 'utf-8')
        const config = JSON.parse(configFile)

        return config.dataPath
      } catch (error) {
        logger.error('Error reading mount directory:', error)
        throw new Error('Failed to read mount directory')
      }
    },
    getLocalParams: async (
      _: any,
      { consortiumId, mountDir }: { consortiumId: string; mountDir: string },
      context: any,
    ): Promise<string> => {
      // Auth check
      const { tokenPayload } = context
      const { userId } = tokenPayload || {}
      if (!userId) {
        throw new Error('Not authorized')
      }

      const configPath = path.join(mountDir, 'local_parameters.json')

      try {
        const configFile = await fs.readFile(configPath, 'utf-8')
        return configFile
      } catch (err: any) {
        // If the file simply doesn't exist, warn and return a safe default
        if (err?.code === 'ENOENT') {
          logger.warn(
            `local_parameters.json not found at ${configPath} (consortiumId=${consortiumId}, userId=${userId}). Returning default "{}".`
          )
          // Return valid, empty JSON so downstream JSON.parse won't explode
          return '{}'
        }

        // Anything else is a real error (permissions, I/O, etc.)
        logger.error(`Error reading ${configPath}:`, err)
        throw new Error('Failed to read local parameters from mount directory')
      }
    },
  },

  Mutation: {
    connectAsUser: async (_: any, args: any, context: any): Promise<string> => {
      logger.info('connectAsUser')
      try {
        // Make the runCoordinator connect to the centralApi
        inMemoryStore.set('accessToken', context.accessToken)

        const { wsUrl } = getConfig()
        runCoordinator.subscribeToCentralApi({
          wsUrl,
          accessToken: context.accessToken,
        })
        return JSON.stringify(context)
      } catch (error) {
        logger.error('Error in connectAsUser:', error)
        throw new Error('Failed to connect as user')
      }
    },
    setMountDir: async (
      _: any,
      { consortiumId, mountDir }: { consortiumId: string; mountDir: string },
      context: any,
    ): Promise<boolean> => {
      try {
        const { pathBaseDirectory } = getConfig()
        const consortiumDir = path.join(pathBaseDirectory, consortiumId)

        // Ensure the consortium directory exists
        await fs.mkdir(consortiumDir, { recursive: true })

        // Define the path to the mount_config.json file
        const configPath = path.join(consortiumDir, 'mount_config.json')

        // Write the mountDir to the mount_config.json file
        const configContent = { dataPath: mountDir }
        await fs.writeFile(configPath, JSON.stringify(configContent, null, 2))

        return true
      } catch (error) {
        logger.error('Error in setMountDir:', error)
        throw new Error('Failed to set mount directory')
      }
    },
    setLocalParams: async (
      _: any,
      { consortiumId, mountDir, localParams }: { consortiumId: string; mountDir: string, localParams: string },
      context: any,
    ): Promise<boolean> => {
      try {
        // Validate JSON format before writing
        JSON.parse(localParams)
        
        const configPath = path.join(mountDir, 'local_parameters.json')
        await fs.writeFile(configPath, localParams)

        return true
      } catch (error: any) {
        // If JSON parsing failed, provide a specific error message
        if (error instanceof SyntaxError) {
          logger.error('Invalid JSON in setLocalParams:', error)
          throw new Error('Invalid JSON format in local parameters')
        }
        
        logger.error('Error in setLocalParams:', error)
        throw new Error('Failed to set/save local parameters')
      }
    },
  },
}
