// requestPasswordReset.ts

import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client';
import { LoginOutput, MutationResetPasswordArgs } from './generated/graphql';

export const resetPassword = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: MutationResetPasswordArgs
): Promise<LoginOutput> => {
  const RESET_PASSWORD = gql`
    mutation ResetPassword($token: String!, $newPassword: String!) {
      resetPassword(token: $token, newPassword: $newPassword) {
        accessToken
        userId
        username
        roles
      }
    }
  `;

  const { data, errors } = await apolloClient.mutate<{ resetPassword: LoginOutput }>({
    mutation: RESET_PASSWORD,
    variables: input,
  });

  // Throw GraphQL errors if present
  if (errors?.length) {
    throw new Error(errors.map(err => err.message).join(', '));
  }

  // Ensure the mutation was successful
  if (!data?.resetPassword) {
    throw new Error('resetPassword failed: No data returned');
  }

  return data.resetPassword;
};
