// computationCreate.ts

import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'
import { MutationComputationCreateArgs } from './generated/graphql'

export const computationCreate = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: MutationComputationCreateArgs,
): Promise<void> => {
  const COMPUTATION_CREATE_MUTATION = gql`
    mutation ComputationCreate($title: String!, $imageDownloadUrl: String!, $imageName: String!, $notes: String!) {
      computationCreate(title: $title, imageDownloadUrl: $imageDownloadUrl, imageName: $imageName, notes: $notes)
    }
  `

  const { data, errors } = await apolloClient.mutate<{ computationCreate: boolean }>({
    mutation: COMPUTATION_CREATE_MUTATION,
    variables: input,
  })

  // Throw GraphQL errors if present
  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  // Ensure the mutation was successful
  if (!data?.computationCreate) {
    throw new Error('computationCreate failed: No data returned')
  }
}
