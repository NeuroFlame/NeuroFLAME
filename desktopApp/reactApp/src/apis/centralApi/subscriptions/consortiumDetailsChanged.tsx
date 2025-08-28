import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'

const CONSORTIUM_DETAILS_CHANGED = gql`
  subscription OnConsortiumDetailsChanged($consortiumId: String!) {
    consortiumDetailsChanged(consortiumId: $consortiumId)
  }
`

export function consortiumDetailsChanged(
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: { consortiumId: string }) {
  return {
    subscribe: ({
      next = (data: any) => { },
      error = (error: any) => { },
      complete = () => { },
    }) => {
      const observable = apolloClient.subscribe({
        query: CONSORTIUM_DETAILS_CHANGED,
        variables: input,
      })

      const subscription = observable.subscribe({
        next,
        error,
        complete,
      })
      return subscription
    },
  }
}
