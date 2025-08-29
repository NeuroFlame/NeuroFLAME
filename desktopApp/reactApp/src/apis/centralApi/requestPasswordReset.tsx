// requestPasswordReset.ts

import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client';
import { MutationRequestPasswordResetArgs } from './generated/graphql';

export const requestPasswordReset = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: MutationRequestPasswordResetArgs
): Promise<void> => {
  const REQUEST_PASSWORD_RESET = gql`
    mutation RequestPasswordReset($username: String!) {
      requestPasswordReset(username: $username)
    }
  `;

  const { data, errors } = await apolloClient.mutate<{ requestPasswordReset: boolean }>({
    mutation: REQUEST_PASSWORD_RESET,
    variables: input,
  });

  // Throw GraphQL errors if present
  if (errors?.length) {
    throw new Error(errors.map(err => err.message).join(', '));
  }

  // Ensure the mutation was successful
  if (!data?.requestPasswordReset) {
    throw new Error('requestPasswordReset failed: No data returned');
  }

  return;
};
