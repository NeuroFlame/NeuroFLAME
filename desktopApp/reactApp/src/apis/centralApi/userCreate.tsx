// userCreate.ts

import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'
import { MutationUserCreateArgs, LoginOutput } from './generated/graphql'

export const userCreate = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: MutationUserCreateArgs,
): Promise<LoginOutput> => {
  const USER_CREATE_MUTATION = gql`
    mutation UserCreate($username: String!, $password: String!) {
      userCreate(username: $username, password: $password) {
        accessToken
        userId
        username
        roles
      }
    }
  `

  const { data, errors } = await apolloClient.mutate<{ userCreate: LoginOutput }>({
    mutation: USER_CREATE_MUTATION,
    variables: input,
  })

  // Throw GraphQL errors if present
  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  // Ensure the mutation was successful
  if (!data?.userCreate) {
    throw new Error('userCreate failed: No data returned')
  }

  return data.userCreate
}
