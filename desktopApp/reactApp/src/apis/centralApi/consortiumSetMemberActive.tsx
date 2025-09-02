import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'
import { MutationConsortiumSetMemberActiveArgs } from './generated/graphql' // Use generated types

export const consortiumSetMemberActive = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: MutationConsortiumSetMemberActiveArgs, // Use MutationConsortiumSetMemberActiveArgs type for input
): Promise<void> => {
  const SET_MEMBER_ACTIVE_MUTATION = gql`
    mutation consortiumSetMemberActive($consortiumId: String!, $active: Boolean!) {
      consortiumSetMemberActive(consortiumId: $consortiumId, active: $active)
    }
  `

  const { data, errors } = await apolloClient.mutate<{ consortiumSetMemberActive: void }>({
    mutation: SET_MEMBER_ACTIVE_MUTATION,
    variables: input, // Pass input directly
  })

  // Throw GraphQL errors if present
  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  // Ensure consortiumSetMemberActive data exists
  if (!data?.consortiumSetMemberActive) {
    throw new Error('consortiumSetMemberActive failed: No data returned')
  }

  return data.consortiumSetMemberActive
}
