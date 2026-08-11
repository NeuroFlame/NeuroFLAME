import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'

const DISCONNECT_AS_USER = gql`
  mutation DisconnectAsUser {
    disconnectAsUser
  }
`

export const disconnectAsUser = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
): Promise<void> => {
  await apolloClient.mutate({ mutation: DISCONNECT_AS_USER })
}
