export type EdgeClientConfig = {
  httpUrl: string
  wsUrl: string
  pathBaseDirectory: string
  authenticationEndpoint: string
  hostingPort: number
  logPath?: string
  containerService?: string
}

export type Config = {
  centralServerQueryUrl: string
  centralServerSubscriptionUrl: string
  edgeClientQueryUrl: string
  edgeClientSubscriptionUrl: string
  edgeClientRunResultsUrl: string
  startEdgeClientOnLaunch: boolean
  logPath?: string
  edgeClientConfig: EdgeClientConfig
}
