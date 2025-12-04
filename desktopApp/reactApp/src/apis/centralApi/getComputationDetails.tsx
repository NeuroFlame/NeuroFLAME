// getComputationDetails.ts

import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'
import { QueryGetComputationDetailsArgs, Computation } from './generated/graphql'

export const getComputationDetails = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: QueryGetComputationDetailsArgs,
): Promise<Computation> => {
  const GET_COMPUTATION_DETAILS_QUERY = gql`
    query GetComputationDetails($computationId: String!) {
      getComputationDetails(computationId: $computationId) {
        imageDownloadUrl
        imageName
        notes
        owner
        title
        hasLocalParameters
      }
    }
  `

  const { data, errors } = await apolloClient.query<{ getComputationDetails: Computation }>({
    query: GET_COMPUTATION_DETAILS_QUERY,
    variables: input,
  })

  // Throw GraphQL errors if present
  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  // Ensure data was returned successfully
  if (!data?.getComputationDetails) {
    throw new Error('getComputationDetails failed: No data returned')
  }

  return data.getComputationDetails
}
