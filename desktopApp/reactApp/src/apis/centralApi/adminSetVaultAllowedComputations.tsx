import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'
import { MutationAdminSetVaultAllowedComputationsArgs } from './generated/graphql'

export const adminSetVaultAllowedComputations = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: MutationAdminSetVaultAllowedComputationsArgs,
): Promise<boolean> => {
  const mutation = gql`
    mutation AdminSetVaultAllowedComputations(
      $userId: String!
      $computationIds: [String!]!
    ) {
      adminSetVaultAllowedComputations(
        userId: $userId
        computationIds: $computationIds
      )
    }
  `

  const { data, errors } = await apolloClient.mutate<{
    adminSetVaultAllowedComputations: boolean
  }>({
    mutation,
    variables: input,
  })

  if (errors?.length) {
    throw new Error(errors.map((error) => error.message).join(', '))
  }

  if (!data?.adminSetVaultAllowedComputations) {
    throw new Error('adminSetVaultAllowedComputations failed')
  }

  return data.adminSetVaultAllowedComputations
}
