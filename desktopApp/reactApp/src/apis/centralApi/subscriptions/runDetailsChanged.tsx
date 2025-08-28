import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'

const RUN_DETAILS_CHANGED = gql`
  subscription OnRunDetailsChanged($runId: String!) {
    runDetailsChanged(runId: $runId)
  }
`

export function runDetailsChanged(
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: { runId: string },
) {
  return {
    subscribe: ({
      next = (data: any) => {},
      error = (error: any) => {},
      complete = () => {},
    }) => {
      const observable = apolloClient.subscribe({
        query: RUN_DETAILS_CHANGED,
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
