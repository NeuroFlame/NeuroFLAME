import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'

// Define GraphQL query for getting the mount directory
const GET_MOUNT_DIR_QUERY = gql`
  query getMountDir($consortiumId: String!) {
    getMountDir(consortiumId: $consortiumId)
  }
`

// Define function to get the mount directory
export const getMountDir = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  consortiumId: string,
): Promise<string> => {
  const { data, errors } = await apolloClient.query<{ getMountDir: string }>({
    query: GET_MOUNT_DIR_QUERY,
    variables: { consortiumId },
  })

  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  return data.getMountDir
}
