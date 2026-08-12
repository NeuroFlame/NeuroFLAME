import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'
import { MutationAdminUpdateVaultServerArgs } from './generated/graphql'

export const adminUpdateVaultServer = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: MutationAdminUpdateVaultServerArgs,
) => {
  const mutation = gql`
    mutation AdminUpdateVaultServer(
      $serverId: String!
      $name: String!
      $description: String!
    ) {
      adminUpdateVaultServer(
        serverId: $serverId
        name: $name
        description: $description
      )
    }
  `

  const { data, errors } = await apolloClient.mutate<{
    adminUpdateVaultServer: boolean
  }>({ mutation, variables: input })

  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  if (!data?.adminUpdateVaultServer) {
    throw new Error('adminUpdateVaultServer failed: No data returned')
  }

  return data.adminUpdateVaultServer
}
