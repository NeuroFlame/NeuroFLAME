import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'
import { Query } from './generated/graphql' // Import generated types

// Define the GraphQL query for fetching the computation list
export const GET_COMPUTATION_LIST = gql`
  query GetComputationList {
    getComputationList {
      id
      title
      imageName
    }
  }
`

// Fetch the computation list from the GraphQL API using Apollo Client
export const getComputationList = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
): Promise<Query['getComputationList']> => {
  const { data, errors } = await apolloClient.query<{ getComputationList: Query['getComputationList'] }>({
    query: GET_COMPUTATION_LIST,
  })

  // Throw GraphQL errors if present
  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  // Ensure data exists
  if (!data?.getComputationList) {
    throw new Error('Failed to fetch computation list: No data returned')
  }

  return data.getComputationList
}
