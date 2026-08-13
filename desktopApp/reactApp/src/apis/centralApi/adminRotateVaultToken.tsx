import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'
import { MutationAdminRotateVaultTokenArgs } from './generated/graphql'

export const adminRotateVaultToken = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: MutationAdminRotateVaultTokenArgs,
) => {
  const mutation = gql`
    mutation AdminRotateVaultToken($serverId: String!) {
      adminRotateVaultToken(serverId: $serverId)
    }
  `

  const { data, errors } = await apolloClient.mutate<{
    adminRotateVaultToken: string
  }>({ mutation, variables: input })

  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  if (!data?.adminRotateVaultToken) {
    throw new Error('adminRotateVaultToken failed: No data returned')
  }

  return data.adminRotateVaultToken
}
