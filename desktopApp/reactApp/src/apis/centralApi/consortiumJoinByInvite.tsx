// consortiumJoinByInvite.ts

import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'
import { MutationConsortiumJoinByInviteArgs } from './generated/graphql'

export const consortiumJoinByInvite = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: MutationConsortiumJoinByInviteArgs,
): Promise<void> => {
  const CONSORTIUM_JOIN_BY_INVITE_MUTATION = gql`
    mutation ConsortiumJoinByInvite($inviteToken: String!) {
      consortiumJoinByInvite(inviteToken: $inviteToken)
    }
  `

  const { data, errors } = await apolloClient.mutate<{ consortiumJoinByInvite: boolean }>({
    mutation: CONSORTIUM_JOIN_BY_INVITE_MUTATION,
    variables: input,
  })

  // Throw GraphQL errors if present
  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  // Ensure the mutation was successful
  if (!data?.consortiumJoinByInvite) {
    throw new Error('consortiumJoinByInvite failed: No data returned')
  }
}
