// consortiumCreate.ts

import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'
import { MutationConsortiumCreateArgs } from './generated/graphql'

export const consortiumCreate = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: MutationConsortiumCreateArgs,
): Promise<string> => {
  const CONSORTIUM_CREATE_MUTATION = gql`
    mutation ConsortiumCreate($title: String!, $description: String!) {
      consortiumCreate(title: $title, description: $description)
    }
  `

  const { data, errors } = await apolloClient.mutate<{ consortiumCreate: string }>({
    mutation: CONSORTIUM_CREATE_MUTATION,
    variables: input,
  })

  // Throw GraphQL errors if present
  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  // Ensure data was returned successfully
  if (!data?.consortiumCreate) {
    throw new Error('consortiumCreate failed: No data returned')
  }

  return data.consortiumCreate
}
