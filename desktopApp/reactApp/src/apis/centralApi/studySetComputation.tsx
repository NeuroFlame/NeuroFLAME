import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'
import { MutationStudySetComputationArgs } from './generated/graphql' // Use generated types

export const studySetComputation = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: MutationStudySetComputationArgs, // Use MutationStudySetComputationArgs type for input
): Promise<void> => {
  const STUDY_SET_COMPUTATION_MUTATION = gql`
    mutation studySetComputation($consortiumId: String!, $computationId: String!) {
      studySetComputation(consortiumId: $consortiumId, computationId: $computationId)
    }
  `

  const { data, errors } = await apolloClient.mutate<{ studySetComputation: void }>({
    mutation: STUDY_SET_COMPUTATION_MUTATION,
    variables: input, // Pass input directly
  })

  // Throw GraphQL errors if present
  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  // Ensure studySetComputation data exists
  if (!data?.studySetComputation) {
    throw new Error('studySetComputation failed: No data returned')
  }

  return data.studySetComputation
}
