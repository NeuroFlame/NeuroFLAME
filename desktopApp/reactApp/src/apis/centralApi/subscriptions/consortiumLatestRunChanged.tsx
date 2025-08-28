import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'

// Define the subscription query for consortiumLatestRunChanged
const CONSORTIUM_LATEST_RUN_CHANGED = gql`
  subscription OnConsortiumLatestRunChanged($consortiumId: String!) {
    consortiumLatestRunChanged(consortiumId: $consortiumId)
  }
`

// Function to manage the consortiumLatestRunChanged subscription imperatively
export function consortiumLatestRunChanged(
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: { consortiumId: string },
) {
  return {
    subscribe: ({
      next = (data: any) => {},
      error = (error: any) => {},
      complete = () => {},
    }) => {
      const observable = apolloClient.subscribe({
        query: CONSORTIUM_LATEST_RUN_CHANGED,
        variables: input, // Pass the consortiumId as a variable
      })

      const subscription = observable.subscribe({
        next,
        error,
        complete,
      })

      // Return the subscription instance so that it can be unsubscribed later
      return subscription
    },
  }
}
