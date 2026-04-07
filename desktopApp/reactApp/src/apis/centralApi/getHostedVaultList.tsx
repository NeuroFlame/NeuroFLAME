import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'
import { Query, QueryGetHostedVaultListArgs } from './generated/graphql'

const GET_HOSTED_VAULT_LIST = gql`
  query GetHostedVaultList($serverId: String) {
    getHostedVaultList(serverId: $serverId) {
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
`

export const getHostedVaultList = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: QueryGetHostedVaultListArgs = {},
): Promise<Query['getHostedVaultList']> => {
  const { data, errors } = await apolloClient.query<{ getHostedVaultList: Query['getHostedVaultList'] }>({
    query: GET_HOSTED_VAULT_LIST,
    variables: input,
    fetchPolicy: 'network-only',
  })

  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  if (!data?.getHostedVaultList) {
    throw new Error('Failed to fetch hosted vaults: No data returned')
  }

  return data.getHostedVaultList
}
