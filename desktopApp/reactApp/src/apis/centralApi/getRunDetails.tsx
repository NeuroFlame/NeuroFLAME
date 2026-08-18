import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client'
import { Query, QueryGetRunDetailsArgs } from './generated/graphql' // Adjust based on your actual generated types

const RUN_ERROR_SCHEMA_CAPABILITIES = gql`
  query RunErrorSchemaCapabilities {
    __type(name: "RunError") {
      fields {
        name
      }
    }
  }
`

const runErrorVaultSupport = new WeakMap<
  ApolloClient<NormalizedCacheObject>,
  Promise<boolean>
>()

const supportsRunErrorVault = (
  apolloClient: ApolloClient<NormalizedCacheObject>,
): Promise<boolean> => {
  const cachedSupport = runErrorVaultSupport.get(apolloClient)
  if (cachedSupport) {
    return cachedSupport
  }

  const support = apolloClient.query<{
    __type: { fields: Array<{ name: string }> } | null
  }>({
    query: RUN_ERROR_SCHEMA_CAPABILITIES,
    fetchPolicy: 'no-cache',
  }).then(({ data }) => (
    data?.__type?.fields.some(({ name }) => name === 'vault') ?? false
  )).catch(() => {
    // Let the run-details request surface connection failures. Using the legacy
    // selection here keeps the UI compatible with APIs that disable introspection.
    runErrorVaultSupport.delete(apolloClient)
    return false
  })

  runErrorVaultSupport.set(apolloClient, support)
  return support
}

// RunError.vault was added after the original run-details API. Build the
// selection from the server's schema so a newer desktop app can still inspect
// historical runs while the central API is being upgraded.
const getRunDetailsQuery = (includeErrorVault: boolean) => gql`
  query GetRunDetails($runId: String!) {
    getRunDetails(runId: $runId) {
      runId
      consortium {
        id
        title
        leader {
          id
          username
        }
        activeMembers {
          id
          username
        }
        activeVaultMembers {
          id
          serverId
          name
          description
          datasetKey
          active
          allowedComputations {
            id
            title
            imageName
          }
        }
        readyMembers {
          id
          username
        }
        readyVaultMembers {
          id
          serverId
          name
          description
          datasetKey
          active
          allowedComputations {
            id
            title
            imageName
          }
        }
      }
      createdAt
      lastUpdated
      status
      members {
        id
        username
        vault {
          name
          description
        }
      }
      vaultMembers {
        id
        serverId
        name
        description
        datasetKey
        active
        allowedComputations {
          id
          title
          imageName
        }
      }
      runErrors {
        message
        timestamp
        ${includeErrorVault ? 'vault { id name }' : ''}
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
          hasLocalParameters
        }
        computationParameters
        consortiumLeaderNotes
      }
    }
  }
`

// Fetch the run details from the GraphQL API using Apollo Client
export const getRunDetails = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  input: QueryGetRunDetailsArgs, // Adjust based on your actual generated types
): Promise<Query['getRunDetails']> => {
  const { runId } = input
  const includeErrorVault = await supportsRunErrorVault(apolloClient)
  const { data, errors } = await apolloClient.query<{ getRunDetails: Query['getRunDetails'] }>({
    query: getRunDetailsQuery(includeErrorVault),
    variables: { runId },
  })

  // Throw GraphQL errors if present
  if (errors?.length) {
    throw new Error(errors.map((err) => err.message).join(', '))
  }

  // Ensure data exists
  if (!data?.getRunDetails) {
    throw new Error(`Failed to fetch run details for ID: ${runId}`)
  }

  return data.getRunDetails
}
