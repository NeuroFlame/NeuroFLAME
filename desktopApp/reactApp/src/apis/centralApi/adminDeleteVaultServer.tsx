import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'
import { MutationAdminDeleteVaultServerArgs } from './generated/graphql'

export const adminDeleteVaultServer = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: MutationAdminDeleteVaultServerArgs,
) => {
  const mutation = gql`
    mutation AdminDeleteVaultServer($serverId: String!) {
      adminDeleteVaultServer(serverId: $serverId)
    }
  `

  const { data, errors } = await apolloClient.mutate<{
    adminDeleteVaultServer: boolean
  }>({ mutation, variables: input })

  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  if (!data?.adminDeleteVaultServer) {
    throw new Error('adminDeleteVaultServer failed: No data returned')
  }

  return data.adminDeleteVaultServer
}
