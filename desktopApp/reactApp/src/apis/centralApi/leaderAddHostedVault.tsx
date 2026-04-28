import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'
import { MutationLeaderAddHostedVaultArgs } from './generated/graphql'

export const leaderAddHostedVault = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: MutationLeaderAddHostedVaultArgs,
) => {
  const mutation = gql`
    mutation LeaderAddHostedVault($consortiumId: String!, $vaultId: String!) {
      leaderAddHostedVault(consortiumId: $consortiumId, vaultId: $vaultId)
    }
  `

  const { data, errors } = await apolloClient.mutate<{ leaderAddHostedVault: boolean }>({
    mutation,
    variables: input,
  })

  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  if (!data?.leaderAddHostedVault) {
    throw new Error('leaderAddHostedVault failed: No data returned')
  }

  return data.leaderAddHostedVault
}
