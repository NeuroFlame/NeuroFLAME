// userChangePassword.ts

import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'
import { MutationUserChangePasswordArgs } from './generated/graphql'

export const userChangePassword = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: MutationUserChangePasswordArgs,
): Promise<void> => {
  const USER_CHANGE_PASSWORD_MUTATION = gql`
    mutation UserChangePassword($password: String!) {
      userChangePassword(password: $password)
    }
  `

  const { data, errors } = await apolloClient.mutate<{ userChangePassword: boolean }>({
    mutation: USER_CHANGE_PASSWORD_MUTATION,
    variables: input,
  })

  // Throw GraphQL errors if present
  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  // Ensure the mutation was successful
  if (!data?.userChangePassword) {
    throw new Error('userChangePassword failed: No data returned')
  }
}
