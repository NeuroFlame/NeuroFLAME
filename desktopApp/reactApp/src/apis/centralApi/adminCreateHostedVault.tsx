import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'
import { MutationAdminCreateHostedVaultArgs } from './generated/graphql'

export const adminCreateHostedVault = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: MutationAdminCreateHostedVaultArgs,
) => {
  const mutation = gql`
    mutation AdminCreateHostedVault(
      $serverId: String!
      $name: String!
      $description: String!
      $datasetKey: String!
    ) {
      adminCreateHostedVault(
        serverId: $serverId
        name: $name
        description: $description
        datasetKey: $datasetKey
      )
    }
  `

  const { data, errors } = await apolloClient.mutate<{ adminCreateHostedVault: string }>({
    mutation,
    variables: input,
  })

  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  if (!data?.adminCreateHostedVault) {
    throw new Error('adminCreateHostedVault failed: No data returned')
  }

  return data.adminCreateHostedVault
}
