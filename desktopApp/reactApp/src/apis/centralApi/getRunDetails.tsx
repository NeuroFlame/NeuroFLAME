import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'
import { Query, QueryGetRunDetailsArgs } from './generated/graphql' // Adjust based on your actual generated types

// Define the GraphQL query for fetching the run details
const GET_RUN_DETAILS = gql`
  query GetRunDetails($runId: String!) {
    getRunDetails(runId: $runId) {
      runId
      consortiumId
      consortiumTitle
      createdAt
      lastUpdated
      status
      members {
        id
        username
      }
      runErrors {
        message
        timestamp
        user {
          id
          username
        }
      }
      studyConfiguration {
        computation {
          title
          imageName
          imageDownloadUrl
          notes
        }
        computationParameters
        consortiumLeaderNotes
      }
    }
  }
`

// Fetch the run details from the GraphQL API using Apollo Client
export const getRunDetails = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: QueryGetRunDetailsArgs, // Adjust based on your actual generated types
): Promise<Query['getRunDetails']> => {
  const { runId } = input
  const { data, errors } = await apolloClient.query<{ getRunDetails: Query['getRunDetails'] }>({
    query: GET_RUN_DETAILS,
    variables: { runId },
  })

  // Throw GraphQL errors if present
  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  // Ensure data exists
  if (!data?.getRunDetails) {
    throw new Error(`Failed to fetch run details for ID: ${runId}`)
  }

  return data.getRunDetails
}
