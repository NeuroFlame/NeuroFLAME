import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'

// Define GraphQL mutation for setting the mount directory
const SET_LOCAL_PARAMS_MUTATION = gql`
  mutation setLocalParams($consortiumId: String!, $mountDir: String!, $localParams: String!) {
    setLocalParams(consortiumId: $consortiumId, mountDir: $mountDir, localParams: $localParams)
  }
`

// Define function to set the mount directory
export const setLocalParams = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  consortiumId: string,
  mountDir: string,
  localParams: string,
): Promise<boolean> => {
  const { data, errors } = await apolloClient.mutate<{ setLocalParams: boolean }>({
    mutation: SET_LOCAL_PARAMS_MUTATION,
    variables: { consortiumId, mountDir, localParams },
  })

  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  if (!data?.setLocalParams) {
    throw new Error('setLocalParams failed: No data returned')
  }

  return data.setLocalParams
}
