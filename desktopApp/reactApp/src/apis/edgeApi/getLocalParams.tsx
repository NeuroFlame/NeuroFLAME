import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'

// Define GraphQL query for getting the mount directory
const GET_LOCAL_PARAMS_QUERY = gql`
  query getLocalParams($consortiumId: String!, $mountDir: String!) {
    getLocalParams(consortiumId: $consortiumId, mountDir: $mountDir)
  }
`

// Define function to get the mount directory
export const getLocalParams = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  consortiumId: string,
  mountDir: string,
): Promise<string> => {
  const { data, errors } = await apolloClient.query<{ getLocalParams: string }>({
    query: GET_LOCAL_PARAMS_QUERY,
    variables: { consortiumId, mountDir },
  })

  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  return data.getLocalParams
}
