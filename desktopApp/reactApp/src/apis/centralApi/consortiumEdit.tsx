// consortiumEdit.ts

import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'
import { MutationConsortiumEditArgs } from './generated/graphql'

export const consortiumEdit = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: MutationConsortiumEditArgs,
): Promise<void> => {
  const CONSORTIUM_EDIT_MUTATION = gql`
    mutation ConsortiumEdit($consortiumId: String!, $title: String!, $description: String!, $isPrivate: Boolean) {
      consortiumEdit(consortiumId: $consortiumId, title: $title, description: $description, isPrivate: $isPrivate)
    }
  `

  const { data, errors } = await apolloClient.mutate<{ consortiumEdit: boolean }>({
    mutation: CONSORTIUM_EDIT_MUTATION,
    variables: input,
  })

  // Throw GraphQL errors if present
  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  // Ensure the mutation was successful
  if (!data?.consortiumEdit) {
    throw new Error('consortiumEdit failed: No data returned')
  }
}
