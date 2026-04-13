// runDelete.ts

import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'
import { MutationRunDeleteArgs } from './generated/graphql'

export const runDelete = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: MutationRunDeleteArgs,
): Promise<void> => {
  const RUN_DELETE_MUTATION = gql`
    mutation RunDelete($runId: String!) {
      runDelete(runId: $runId)
    }
  `

  const { data, errors } = await apolloClient.mutate<{ runDelete: boolean }>({
    mutation: RUN_DELETE_MUTATION,
    variables: input,
  })

  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  if (!data?.runDelete) {
    throw new Error('runDelete failed: No data returned')
  }
}
