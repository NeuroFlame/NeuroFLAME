import { Config } from './types'

export const defaultConfig: Config = {
  centralServerQueryUrl: 'http://54.144.192.206:3001/graphql',
  centralServerSubscriptionUrl: 'ws://54.144.192.206:3001/graphql',
  edgeClientQueryUrl: 'http://localhost:3003/graphql',
  edgeClientSubscriptionUrl: 'ws://localhost:3003/graphql',
  edgeClientRunResultsUrl: 'http://localhost:3003/run-results',
  startEdgeClientOnLaunch: true,
  logPath: '',
  edgeClientConfig: {
    httpUrl: 'http://54.144.192.206:3001/graphql',
    wsUrl: 'ws://54.144.192.206:3001/graphql',
    path_base_directory:
      '',
    authenticationEndpoint: 'http://54.144.192.206:3001/authenticateToken',
    hostingPort: 3003,
    logPath: '',
  },
}

export const testConfig: Config = {
  centralServerQueryUrl: 'http://localhost:3001/graphql',
  centralServerSubscriptionUrl: 'ws://localhost:3001/graphql',
  edgeClientQueryUrl: 'http://localhost:3003/graphql',
  edgeClientSubscriptionUrl: 'ws://localhost:3003/graphql',
  edgeClientRunResultsUrl: 'http://localhost:3003/run-results',
  startEdgeClientOnLaunch: true,
  logPath: '',
  edgeClientConfig: {
    httpUrl: 'http://localhost:3001/graphql',
    wsUrl: 'ws://localhost:3001/graphql',
    path_base_directory:
      '',
    authenticationEndpoint: 'http://localhost:3001/authenticateToken',
    hostingPort: 3003,
    logPath: '',
  },
}

export const testConfigCI: Config = {
  centralServerQueryUrl: 'http://api:3001/graphql',
  centralServerSubscriptionUrl: 'ws://api:3001/graphql',
  edgeClientQueryUrl: 'http://localhost:3003/graphql',
  edgeClientSubscriptionUrl: 'ws://localhost:3003/graphql',
  edgeClientRunResultsUrl: 'http://localhost:3003/run-results',
  startEdgeClientOnLaunch: true,
  logPath: '',
  edgeClientConfig: {
    httpUrl: 'http://api:3001/graphql',
    wsUrl: 'ws://api:3001/graphql',
    path_base_directory:
      '/tmp/_devTestDirectories/_devTestDirectories/edgeSite1',
    authenticationEndpoint: 'http://api:3001/authenticateToken',
    hostingPort: 3003,
    logPath: '/tmp/_devTestDirectories/neuroflame/logs/edgeClient',
  },
}
