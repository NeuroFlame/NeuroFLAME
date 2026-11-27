import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'

const SINGULARITY_IMAGE_CACHED_QUERY = gql`
  query singularityImageCached($imageName: String!) {
    singularityImageCached(imageName: $imageName)
  }
`

const PULL_SINGULARITY_IMAGE_MUTATION = gql`
  mutation pullSingularityImage($imageName: String!) {
    pullSingularityImage(imageName: $imageName)
  }
`

export const singularityImageCached = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  imageName: string,
): Promise<boolean> => {
  const { data, errors } = await apolloClient.query<{ singularityImageCached: boolean }>({
    query: SINGULARITY_IMAGE_CACHED_QUERY,
    variables: { imageName },
    fetchPolicy: 'network-only',
  })

  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  return data?.singularityImageCached === true
}

export const pullSingularityImage = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  imageName: string,
): Promise<void> => {
  const { data, errors } = await apolloClient.mutate<{ pullSingularityImage: boolean }>({
    mutation: PULL_SINGULARITY_IMAGE_MUTATION,
    variables: { imageName },
  })

  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  if (!data?.pullSingularityImage) {
    throw new Error('pullSingularityImage failed: No data returned')
  }
}
