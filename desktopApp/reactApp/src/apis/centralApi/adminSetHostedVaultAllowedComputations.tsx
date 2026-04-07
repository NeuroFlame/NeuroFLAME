import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'
import { MutationAdminSetHostedVaultAllowedComputationsArgs } from './generated/graphql'

export const adminSetHostedVaultAllowedComputations = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: MutationAdminSetHostedVaultAllowedComputationsArgs,
) => {
  const mutation = gql`
    mutation AdminSetHostedVaultAllowedComputations(
      $vaultId: String!
      $computationIds: [String!]!
    ) {
      adminSetHostedVaultAllowedComputations(
        vaultId: $vaultId
        computationIds: $computationIds
      )
    }
  `

  const { data, errors } = await apolloClient.mutate<{ adminSetHostedVaultAllowedComputations: boolean }>({
    mutation,
    variables: input,
  })

  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  if (!data?.adminSetHostedVaultAllowedComputations) {
    throw new Error('adminSetHostedVaultAllowedComputations failed: No data returned')
  }

  return data.adminSetHostedVaultAllowedComputations
}
