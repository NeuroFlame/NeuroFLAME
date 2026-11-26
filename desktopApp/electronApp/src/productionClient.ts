import path from 'node:path'
import { mkdirSync } from 'node:fs'
import type { App } from 'electron'
import { defaultConfig } from './defaultConfig.js'
import type { Config } from './types.js'

export function getProductionClient(args: string[]): number | undefined {
  const options = args.filter((arg) => arg.startsWith('--production-client'))
  if (!options.length) return undefined
  if (options.length !== 1 || !/^--production-client=([1-9]\d?)$/.test(options[0])) {
    throw new Error('Use --production-client=N with a client number from 1 to 99')
  }
  return Number(options[0].split('=')[1])
}

export function productionClientConfig(client: number): Config {
  if (!Number.isInteger(client) || client < 1 || client > 99) {
    throw new Error('Production client number must be from 1 to 99')
  }
  const port = 3002 + client
  return {
    ...defaultConfig,
    edgeClientQueryUrl: `http://localhost:${port}/graphql`,
    edgeClientSubscriptionUrl: `ws://localhost:${port}/graphql`,
    edgeClientRunResultsUrl: `http://localhost:${port}/run-results`,
    edgeClientConfig: { ...defaultConfig.edgeClientConfig, hostingPort: port },
  }
}

export function configureProductionClient(
  app: Pick<App, 'getPath' | 'setPath'>,
  args: string[],
): number | undefined {
  const client = getProductionClient(args)
  if (client === undefined) return undefined
  const directory = path.join(app.getPath('userData'), 'profiles', `production-client-${client}`)
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  // Both paths must be set before Electron creates any browser sessions.
  app.setPath('userData', directory)
  app.setPath('sessionData', directory)
  return client
}
