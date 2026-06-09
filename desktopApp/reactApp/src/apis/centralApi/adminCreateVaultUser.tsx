import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'
import { LoginOutput } from './generated/graphql'

interface AdminCreateVaultUserArgs {
  username: string
  password: string
}

export const adminCreateVaultUser = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: AdminCreateVaultUserArgs,
): Promise<LoginOutput> => {
  const mutation = gql`
    mutation AdminCreateVaultUser($username: String!, $password: String!) {
      adminCreateVaultUser(username: $username, password: $password) {
        accessToken
        userId
        username
        roles
      }
    }
  `

  const { data, errors } = await apolloClient.mutate<{ adminCreateVaultUser: LoginOutput }>({
    mutation,
    variables: input,
  })

  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  if (!data?.adminCreateVaultUser) {
    throw new Error('adminCreateVaultUser failed: No data returned')
  }

  return data.adminCreateVaultUser
}
