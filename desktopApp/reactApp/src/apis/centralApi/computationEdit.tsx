// computationEdit.ts

import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'
import { MutationComputationEditArgs } from './generated/graphql'

export const computationEdit = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: MutationComputationEditArgs,
): Promise<void> => {
  const COMPUTATION_EDIT_MUTATION = gql`
    mutation ComputationEdit($computationId: String!, $title: String!, $imageDownloadUrl: String!, $imageName: String!, $notes: String!) {
      computationEdit(computationId: $computationId, title: $title, imageDownloadUrl: $imageDownloadUrl, imageName: $imageName, notes: $notes)
    }
  `

  const { data, errors } = await apolloClient.mutate<{ computationEdit: boolean }>({
    mutation: COMPUTATION_EDIT_MUTATION,
    variables: input,
  })

  // Throw GraphQL errors if present
  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  // Ensure the mutation was successful
  if (!data?.computationEdit) {
    throw new Error('computationEdit failed: No data returned')
  }
}
