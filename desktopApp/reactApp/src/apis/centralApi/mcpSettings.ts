import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'

export interface McpConnection {
  id: string
  clientName: string
  createdAt: string
  lastUsedAt: string
}

export interface McpSettings {
  enabled: boolean
  resultsEnabled: boolean
  endpoint: string
  connections: McpConnection[]
}

const SETTINGS_FIELDS = gql`
  fragment McpSettingsFields on McpSettings {
    enabled
    resultsEnabled
    endpoint
    connections {
      id
      clientName
      createdAt
      lastUsedAt
    }
  }
`

export async function getMcpSettings(
  client: ApolloClient<NormalizedCacheObject>,
): Promise<McpSettings> {
  const { data } = await client.query<{ getMcpSettings: McpSettings }>({
    query: gql`
      ${SETTINGS_FIELDS}
      query GetMcpSettings { getMcpSettings { ...McpSettingsFields } }
    `,
    fetchPolicy: 'no-cache',
  })
  return data.getMcpSettings
}

export async function setMcpEnabled(
  client: ApolloClient<NormalizedCacheObject>,
  enabled: boolean,
): Promise<McpSettings> {
  const { data } = await client.mutate<{ setMcpEnabled: McpSettings }>({
    mutation: gql`
      ${SETTINGS_FIELDS}
      mutation SetMcpEnabled($enabled: Boolean!) {
        setMcpEnabled(enabled: $enabled) { ...McpSettingsFields }
      }
    `,
    variables: { enabled },
  })
  if (!data) throw new Error('No MCP settings returned')
  return data.setMcpEnabled
}

export async function setMcpResultsEnabled(
  client: ApolloClient<NormalizedCacheObject>,
  enabled: boolean,
): Promise<McpSettings> {
  const { data } = await client.mutate<{ setMcpResultsEnabled: McpSettings }>({
    mutation: gql`
      ${SETTINGS_FIELDS}
      mutation SetMcpResultsEnabled($enabled: Boolean!) {
        setMcpResultsEnabled(enabled: $enabled) { ...McpSettingsFields }
      }
    `,
    variables: { enabled },
  })
  if (!data) throw new Error('No MCP settings returned')
  return data.setMcpResultsEnabled
}

export async function revokeMcpConnection(
  client: ApolloClient<NormalizedCacheObject>,
  connectionId: string,
): Promise<boolean> {
  const { data } = await client.mutate<{ revokeMcpConnection: boolean }>({
    mutation: gql`
      mutation RevokeMcpConnection($connectionId: String!) {
        revokeMcpConnection(connectionId: $connectionId)
      }
    `,
    variables: { connectionId },
  })
  return data?.revokeMcpConnection ?? false
}
