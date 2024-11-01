export type EdgeClientConfig = {
    httpUrl: string
    wsUrl: string
    path_base_directory: string
    authenticationEndpoint: string
    hostingPort: number
    logPath?: string
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
  