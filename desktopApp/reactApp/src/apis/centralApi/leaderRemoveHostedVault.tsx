import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'
import { MutationLeaderRemoveHostedVaultArgs } from './generated/graphql'

export const leaderRemoveHostedVault = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: MutationLeaderRemoveHostedVaultArgs,
) => {
  const mutation = gql`
    mutation LeaderRemoveHostedVault($consortiumId: String!, $vaultId: String!) {
      leaderRemoveHostedVault(consortiumId: $consortiumId, vaultId: $vaultId)
    }
  `

  const { data, errors } = await apolloClient.mutate<{ leaderRemoveHostedVault: boolean }>({
    mutation,
    variables: input,
  })

  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  if (!data?.leaderRemoveHostedVault) {
    throw new Error('leaderRemoveHostedVault failed: No data returned')
  }

  return data.leaderRemoveHostedVault
}
