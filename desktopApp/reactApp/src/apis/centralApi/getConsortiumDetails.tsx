import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'
import { Query, QueryGetConsortiumDetailsArgs } from './generated/graphql' // Adjust based on your actual generated types

// Define the GraphQL query for fetching the consortium details
const GET_CONSORTIUM_DETAILS = gql`
  query GetConsortiumDetails($consortiumId: String!) {
    getConsortiumDetails(consortiumId: $consortiumId) {
      id
      title
      description
      leader {
        id
        username
      }
      members {
        id
        username
      }
      activeMembers {
        id
        username
      }
      readyMembers {
        id
        username
      }
      studyConfiguration {
        consortiumLeaderNotes
        computationParameters
        computation {
          title
          imageName
          imageDownloadUrl
          notes
          owner
        }
      }
    }
  }
`

// Fetch the consortium details from the GraphQL API using Apollo Client
export const getConsortiumDetails = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: QueryGetConsortiumDetailsArgs,  // Adjust based on your actual generated types
): Promise<Query['getConsortiumDetails']> => {
  const { consortiumId } = input
  const { data, errors } = await apolloClient.query<{ getConsortiumDetails: Query['getConsortiumDetails'] }>({
    query: GET_CONSORTIUM_DETAILS,
    variables: { consortiumId },
  })

  // Throw GraphQL errors if present
  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  // Ensure data exists
  if (!data?.getConsortiumDetails) {
    throw new Error(`Failed to fetch consortium details for ID: ${consortiumId}`)
  }

  return data.getConsortiumDetails
}
