import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'
import { MutationStartRunArgs, StartRunOutput } from './generated/graphql' // Use generated types

export const startRun = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: MutationStartRunArgs, // Use MutationStartRunArgs type for input
): Promise<StartRunOutput> => {
  const START_RUN_MUTATION = gql`
    mutation startRun($input: StartRunInput!) {
      startRun(input: $input) {
        runId
      }
    }
  `

  const { data, errors } = await apolloClient.mutate<{ startRun: StartRunOutput }>({
    mutation: START_RUN_MUTATION,
    variables: input, // Pass input directly
  })

  // Handle GraphQL errors
  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  // Ensure startRun data exists
  if (!data?.startRun) {
    throw new Error('startRun failed: No data returned')
  }

  return data.startRun
}
