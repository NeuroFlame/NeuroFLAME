import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'
import { MutationLoginArgs, LoginOutput } from './generated/graphql' // Use generated types

export const login = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: MutationLoginArgs, // Use MutationLoginArgs type for input
): Promise<LoginOutput> => {
  const LOGIN_MUTATION = gql`
    mutation Login($username: String!, $password: String!) {
      login(username: $username, password: $password) {
        accessToken
        userId
        username
        roles
      }
    }
  `

  const { data, errors } = await apolloClient.mutate<{ login: LoginOutput }>({
    mutation: LOGIN_MUTATION,
    variables: input, // Pass input directly
  })

  // Throw GraphQL errors if present
  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  // Ensure login data exists
  if (!data?.login) {
    throw new Error('Login failed: No data returned')
  }

  return data.login
}
