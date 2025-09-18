// adminChangeUserPassword.ts

import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'
import { MutationAdminChangeUserPasswordArgs } from './generated/graphql'

export const adminChangeUserPassword = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: MutationAdminChangeUserPasswordArgs,
): Promise<void> => {
  const ADMIN_CHANGE_USER_PASSWORD_MUTATION = gql`
    mutation AdminChangeUserPassword($username: String!, $password: String!) {
      adminChangeUserPassword(username: $username, password: $password)
    }
  `

  const { data, errors } = await apolloClient.mutate<{ adminChangeUserPassword: boolean }>({
    mutation: ADMIN_CHANGE_USER_PASSWORD_MUTATION,
    variables: input,
  })

  // Throw GraphQL errors if present
  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  // Ensure the mutation was successful
  if (!data?.adminChangeUserPassword) {
    throw new Error('adminChangeUserPassword failed: No data returned')
  }
}
