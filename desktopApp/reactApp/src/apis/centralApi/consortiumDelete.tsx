// consortiumDelete.ts

import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'
import { MutationConsortiumDeleteArgs } from './generated/graphql'

export const consortiumDelete = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: MutationConsortiumDeleteArgs,
): Promise<void> => {
  const CONSORTIUM_DELETE_MUTATION = gql`
    mutation ConsortiumDelete($consortiumId: String!) {
      consortiumDelete(consortiumId: $consortiumId)
    }
  `

  const { data, errors } = await apolloClient.mutate<{ consortiumDelete: boolean }>({
    mutation: CONSORTIUM_DELETE_MUTATION,
    variables: input,
  })

  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  if (!data?.consortiumDelete) {
    throw new Error('consortiumDelete failed: No data returned')
  }
}
