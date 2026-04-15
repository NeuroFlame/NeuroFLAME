import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'
import { MutationAdminSetVaultDatasetMappingsArgs } from './generated/graphql'

export const adminSetVaultDatasetMappings = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: MutationAdminSetVaultDatasetMappingsArgs,
): Promise<boolean> => {
  const mutation = gql`
    mutation AdminSetVaultDatasetMappings(
      $userId: String!
      $mappings: [VaultDatasetMappingInput!]!
    ) {
      adminSetVaultDatasetMappings(
        userId: $userId
        mappings: $mappings
      )
    }
  `

  const { data, errors } = await apolloClient.mutate<{
    adminSetVaultDatasetMappings: boolean
  }>({
    mutation,
    variables: input,
  })

  if (errors?.length) {
    throw new Error(errors.map((error) => error.message).join(', '))
  }

  if (!data?.adminSetVaultDatasetMappings) {
    throw new Error('adminSetVaultDatasetMappings failed')
  }

  return data.adminSetVaultDatasetMappings
}
