import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'
import { MutationConsortiumSetMemberReadyArgs } from './generated/graphql' // Use generated types

export const consortiumSetMemberReady = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: MutationConsortiumSetMemberReadyArgs, // Use MutationConsortiumSetMemberReadyArgs type for input
): Promise<void> => {
  const SET_MEMBER_READY_MUTATION = gql`
    mutation consortiumSetMemberReady($consortiumId: String!,  $ready: Boolean!) {
      consortiumSetMemberReady(consortiumId: $consortiumId, ready: $ready)
    }
  `

  const { data, errors } = await apolloClient.mutate<{ consortiumSetMemberReady: void }>({
    mutation: SET_MEMBER_READY_MUTATION,
    variables: input, // Pass input directly
  })

  // Throw GraphQL errors if present
  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  // Ensure consortiumSetMemberReady data exists
  if (!data?.consortiumSetMemberReady) {
    throw new Error('consortiumSetMemberReady failed: No data returned')
  }

  return data.consortiumSetMemberReady
}
