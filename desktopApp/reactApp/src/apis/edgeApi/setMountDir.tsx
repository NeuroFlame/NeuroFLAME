import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'

// Define GraphQL mutation for setting the mount directory
const SET_MOUNT_DIR_MUTATION = gql`
  mutation setMountDir($consortiumId: String!, $mountDir: String!) {
    setMountDir(consortiumId: $consortiumId, mountDir: $mountDir)
  }
`

// Define function to set the mount directory
export const setMountDir = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  consortiumId: string,
  mountDir: string,
): Promise<boolean> => {
  const { data, errors } = await apolloClient.mutate<{ setMountDir: boolean }>({
    mutation: SET_MOUNT_DIR_MUTATION,
    variables: { consortiumId, mountDir },
  })

  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  if (!data?.setMountDir) {
    throw new Error('setMountDir failed: No data returned')
  }

  return data.setMountDir
}
