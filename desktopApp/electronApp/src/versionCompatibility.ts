export type CompatibilityStatus =
  | { status: 'compatible'; appVersion: string; apiVersion?: string }
  | {
    status: 'appUpdateRequired' | 'serverUpdateRequired'
    appVersion: string
    apiVersion?: string
  }

function parseVersion(value: unknown): [number, number, number] | null {
  if (typeof value !== 'string') return null
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value)
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null
}

export function versionEndpoint(graphqlUrl: string): string {
  const endpoint = new URL(graphqlUrl)
  endpoint.pathname = endpoint.pathname.replace(/\/graphql\/?$/, '/version')
  endpoint.search = ''
  endpoint.hash = ''
  return endpoint.toString()
}

export function compareAppAndApiVersions(
  appVersion: string,
  apiVersion: unknown,
): CompatibilityStatus {
  const appParts = parseVersion(appVersion)
  if (!appParts) {
    return { status: 'appUpdateRequired', appVersion }
  }
  const apiParts = parseVersion(apiVersion)
  if (!apiParts) {
    return { status: 'serverUpdateRequired', appVersion }
  }
  const normalizedApiVersion = apiVersion as string
  if (apiParts[0] === appParts[0] && apiParts[1] === appParts[1]) {
    return { status: 'compatible', appVersion, apiVersion: normalizedApiVersion }
  }
  const appIsOlder =
    appParts[0] < apiParts[0] ||
    (appParts[0] === apiParts[0] && appParts[1] < apiParts[1])
  return {
    status: appIsOlder ? 'appUpdateRequired' : 'serverUpdateRequired',
    appVersion,
    apiVersion: normalizedApiVersion,
  }
}
