// src/graphql/getRunDetails.ts
import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'
import { Query, QueryGetRunDetailsArgs } from './generated/graphql'

const GET_RUN_DETAILS = gql`
  query GetRunDetails($runId: String!) {
    getRunDetails(runId: $runId) {
      runId
      consortiumId
      consortiumTitle
      createdAt
      lastUpdated
      status
      meta 
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

export const getRunDetails = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: QueryGetRunDetailsArgs,
): Promise<Query['getRunDetails']> => {
  const { runId } = input
  const { data, errors } = await apolloClient.query<{ getRunDetails: Query['getRunDetails'] }>({
    query: GET_RUN_DETAILS,
    variables: { runId },
    fetchPolicy: 'network-only',   // optional: ensures you see live meta updates
  })

  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }
  if (!data?.getRunDetails) {
    throw new Error(`Failed to fetch run details for ID: ${runId}`)
  }
  return data.getRunDetails
}
