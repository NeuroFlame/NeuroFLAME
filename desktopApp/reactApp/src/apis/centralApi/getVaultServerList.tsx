import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'
import { Query } from './generated/graphql'

const GET_VAULT_SERVER_LIST = gql`
  query GetVaultServerList {
    getVaultServerList {
      id
      userId
      username
      name
      description
      status {
        status
        version
        uptime
        websocketConnected
        lastHeartbeat
        availableDatasets {
          key
          path
          label
        }
        runningComputations {
          runId
          consortiumId
          consortiumTitle
          runStartedAt
          runningFor
        }
      }
      vaults {
        id
        serverId
        name
        description
        datasetKey
        active
        allowedComputations {
          id
          title
          imageName
        }
      }
    }
  }
`

export const getVaultServerList = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
): Promise<Query['getVaultServerList']> => {
  const { data, errors } = await apolloClient.query<{ getVaultServerList: Query['getVaultServerList'] }>({
    query: GET_VAULT_SERVER_LIST,
    fetchPolicy: 'network-only',
  })

  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  if (!data?.getVaultServerList) {
    throw new Error('Failed to fetch vault servers: No data returned')
  }

  return data.getVaultServerList
}
