// consortiumInvite.ts

import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'
import { MutationConsortiumInviteArgs } from './generated/graphql'

export const consortiumInvite = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: MutationConsortiumInviteArgs,
): Promise<void> => {
  const CONSORTIUM_INVITE_MUTATION = gql`
    mutation ConsortiumInvite($consortiumId: String!, $email: String!) {
      consortiumInvite(consortiumId: $consortiumId, email: $email)
    }
  `

  const { data, errors } = await apolloClient.mutate<{ consortiumInvite: boolean }>({
    mutation: CONSORTIUM_INVITE_MUTATION,
    variables: input,
  })

  // Throw GraphQL errors if present
  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  // Ensure the mutation was successful
  if (!data?.consortiumInvite) {
    throw new Error('consortiumInvite failed: No data returned')
  }
}
