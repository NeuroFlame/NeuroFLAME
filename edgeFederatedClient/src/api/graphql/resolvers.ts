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
  },
}
