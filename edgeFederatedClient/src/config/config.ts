export interface edgeClientLaunchConfiguration {
  httpUrl: string
  wsUrl: string
  pathBaseDirectory: string
  authenticationEndpoint: string
  hostingPort: number
  // Per-launch secret supplied by the desktop host; never persisted to config files.
  localApiKey: string
  logPath?: string
  containerService?: string
}

// Holds the configuration instance, initially set to null
let config: edgeClientLaunchConfiguration

export function getConfig(): edgeClientLaunchConfiguration {
  return config
}

export function setConfig(newConfig: edgeClientLaunchConfiguration): void {
  config = newConfig
}
