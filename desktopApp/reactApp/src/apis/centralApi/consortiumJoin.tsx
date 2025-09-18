// consortiumJoin.ts

import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'
import { MutationConsortiumJoinArgs } from './generated/graphql'

export const consortiumJoin = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: MutationConsortiumJoinArgs,
): Promise<void> => {
  const CONSORTIUM_JOIN_MUTATION = gql`
    mutation ConsortiumJoin($consortiumId: String!) {
      consortiumJoin(consortiumId: $consortiumId)
    }
  `

  const { data, errors } = await apolloClient.mutate<{ consortiumJoin: boolean }>({
    mutation: CONSORTIUM_JOIN_MUTATION,
    variables: input,
  })

  // Throw GraphQL errors if present
  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  // Ensure the mutation was successful
  if (!data?.consortiumJoin) {
    throw new Error('consortiumJoin failed: No data returned')
  }
}
