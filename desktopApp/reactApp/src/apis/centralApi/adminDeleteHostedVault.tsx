import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'
import { MutationAdminDeleteHostedVaultArgs } from './generated/graphql'

export const adminDeleteHostedVault = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: MutationAdminDeleteHostedVaultArgs,
) => {
  const mutation = gql`
    mutation AdminDeleteHostedVault($vaultId: String!) {
      adminDeleteHostedVault(vaultId: $vaultId)
    }
  `

  const { data, errors } = await apolloClient.mutate<{
    adminDeleteHostedVault: boolean
  }>({
    mutation,
    variables: input,
  })

  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  if (!data?.adminDeleteHostedVault) {
    throw new Error('adminDeleteHostedVault failed: No data returned')
  }

  return data.adminDeleteHostedVault
}
