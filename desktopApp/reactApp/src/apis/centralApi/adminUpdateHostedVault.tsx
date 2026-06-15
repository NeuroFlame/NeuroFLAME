import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'
import { MutationAdminUpdateHostedVaultArgs } from './generated/graphql'

export const adminUpdateHostedVault = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: MutationAdminUpdateHostedVaultArgs,
) => {
  const mutation = gql`
    mutation AdminUpdateHostedVault(
      $vaultId: String!
      $name: String!
      $description: String!
    ) {
      adminUpdateHostedVault(
        vaultId: $vaultId
        name: $name
        description: $description
      )
    }
  `

  const { data, errors } = await apolloClient.mutate<{ adminUpdateHostedVault: boolean }>({
    mutation,
    variables: input,
  })

  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  if (!data?.adminUpdateHostedVault) {
    throw new Error('adminUpdateHostedVault failed: No data returned')
  }

  return data.adminUpdateHostedVault
}
