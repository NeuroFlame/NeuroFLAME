import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'

const CONNECT_AS_USER = gql`
  mutation ConnectAsUser {
    connectAsUser
  }
`

export const connectAsUser = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,

) => {
  try {
    await apolloClient?.mutate({
      mutation: CONNECT_AS_USER,
    })
  } catch (e: any) {
    console.error(`Error connecting as user: ${e}`)
    throw new Error('Error connecting as user')
  }
}
