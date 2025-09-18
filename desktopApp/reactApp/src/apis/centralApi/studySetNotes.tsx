import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'
import { MutationStudySetNotesArgs } from './generated/graphql' // Use generated types

export const studySetNotes = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: MutationStudySetNotesArgs, // Use MutationStudySetNotesArgs type for input
): Promise<void> => {
  const STUDY_SET_NOTES_MUTATION = gql`
    mutation studySetNotes($consortiumId: String!, $notes: String!) {
      studySetNotes(consortiumId: $consortiumId, notes: $notes)
    }
  `

  const { data, errors } = await apolloClient.mutate<{ studySetNotes: boolean }>({
    mutation: STUDY_SET_NOTES_MUTATION,
    variables: input, // Pass input directly
  })

  // Throw GraphQL errors if present
  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  // Ensure the mutation was successful
  if (!data?.studySetNotes) {
    throw new Error('studySetNotes failed: No data returned')
  }
}
