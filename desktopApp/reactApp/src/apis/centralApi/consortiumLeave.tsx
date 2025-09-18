// consortiumLeave.ts

import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'
import { MutationConsortiumLeaveArgs } from './generated/graphql'

export const consortiumLeave = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: MutationConsortiumLeaveArgs,
): Promise<void> => {
  const CONSORTIUM_LEAVE_MUTATION = gql`
    mutation ConsortiumLeave($consortiumId: String!) {
      consortiumLeave(consortiumId: $consortiumId)
    }
  `

  const { data, errors } = await apolloClient.mutate<{ consortiumLeave: boolean }>({
    mutation: CONSORTIUM_LEAVE_MUTATION,
    variables: input,
  })

  // Throw GraphQL errors if present
  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  // Ensure the mutation was successful
  if (!data?.consortiumLeave) {
    throw new Error('consortiumLeave failed: No data returned')
  }
}
