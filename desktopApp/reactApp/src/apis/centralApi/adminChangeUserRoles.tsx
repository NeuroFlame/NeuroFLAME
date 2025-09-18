// adminChangeUserRoles.ts

import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'
import { MutationAdminChangeUserRolesArgs } from './generated/graphql'

export const adminChangeUserRoles = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: MutationAdminChangeUserRolesArgs,
): Promise<void> => {
  const ADMIN_CHANGE_USER_ROLES_MUTATION = gql`
    mutation AdminChangeUserRoles($username: String!, $roles: [String!]!) {
      adminChangeUserRoles(username: $username, roles: $roles)
    }
  `

  const { data, errors } = await apolloClient.mutate<{ adminChangeUserRoles: boolean }>({
    mutation: ADMIN_CHANGE_USER_ROLES_MUTATION,
    variables: input,
  })

  // Throw GraphQL errors if present
  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  // Ensure the mutation was successful
  if (!data?.adminChangeUserRoles) {
    throw new Error('adminChangeUserRoles failed: No data returned')
  }
}
