import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'
import { MutationStudySetParametersArgs } from './generated/graphql' // Use generated types

export const studySetParameters = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: MutationStudySetParametersArgs, // Use MutationstudySetParametersArgs type for input
): Promise<void> => {
  const STUDY_SET_PARAMETERS_MUTATION = gql`
    mutation studySetParameters($consortiumId: String!, $parameters: String!) {
      studySetParameters(consortiumId: $consortiumId, parameters: $parameters)
    }
  `

  const { data, errors } = await apolloClient.mutate<{ studySetParameters: void }>({
    mutation: STUDY_SET_PARAMETERS_MUTATION,
    variables: input, // Pass input directly
  })

  // Throw GraphQL errors if present
  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  // Ensure studySetParameters data exists
  if (!data?.studySetParameters) {
    throw new Error('studySetParameters failed: No data returned')
  }

  return data.studySetParameters
}
