import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'

const CONNECT_AS_USER = gql`
  mutation ConnectAsUser {
    connectAsUser
  }
`

export const connectAsUser = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,

): Promise<string> => {
  try {
    const { data } = await apolloClient.mutate<{ connectAsUser: string }>({
      mutation: CONNECT_AS_USER,
    })
    if (!data?.connectAsUser) throw new Error('No authenticated edge user returned')
    return data.connectAsUser
  } catch (e: any) {
    console.error(`Error connecting as user: ${e}`)
    throw new Error('Error connecting as user')
  }
}
