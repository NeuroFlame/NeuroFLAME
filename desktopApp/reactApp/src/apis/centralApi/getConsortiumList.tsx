import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'
import { Query } from './generated/graphql' // Import generated types

// Define the GraphQL query for fetching the consortium list
const GET_CONSORTIUM_LIST_QUERY = gql`
  query GetConsortiumList {
    getConsortiumList {
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
    }
  }
`

// Fetch the consortium list from the GraphQL API using Apollo Client
export const getConsortiumList = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
): Promise<Query['getConsortiumList']> => {
  const { data, errors } = await apolloClient.query<{ getConsortiumList: Query['getConsortiumList'] }>({
    query: GET_CONSORTIUM_LIST_QUERY,
  })

  // Throw GraphQL errors if present
  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  // Ensure data exists
  if (!data?.getConsortiumList) {
    throw new Error('Failed to fetch consortium list: No data returned')
  }

  return data.getConsortiumList
}
