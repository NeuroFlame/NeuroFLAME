import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'
import { MutationLeaderSetHostedVaultActiveArgs } from './generated/graphql'

export const leaderSetHostedVaultActive = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: MutationLeaderSetHostedVaultActiveArgs,
) => {
  const mutation = gql`
    mutation LeaderSetHostedVaultActive(
      $consortiumId: String!
      $vaultId: String!
      $active: Boolean!
    ) {
      leaderSetHostedVaultActive(
        consortiumId: $consortiumId
        vaultId: $vaultId
        active: $active
      )
    }
  `

  const { data, errors } = await apolloClient.mutate<{ leaderSetHostedVaultActive: boolean }>({
    mutation,
    variables: input,
  })

  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  if (!data?.leaderSetHostedVaultActive) {
    throw new Error('leaderSetHostedVaultActive failed: No data returned')
  }

  return data.leaderSetHostedVaultActive
}
