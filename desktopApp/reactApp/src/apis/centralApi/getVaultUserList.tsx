import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client';
import { Query } from './generated/graphql'; // Import generated types

// Define the GraphQL query for fetching the computation list
export const GET_VAULT_USER_LIST = gql`
  query GetVaultUserList {
    getVaultUserList {
      id
      username
      vault {
        name
        description
      }
    }
  }
`;

// Fetch the computation list from the GraphQL API using Apollo Client
export const getVaultUserList = async (
  apolloClient: ApolloClient<NormalizedCacheObject>
): Promise<Query['getVaultUserList']> => {
  const { data, errors } = await apolloClient.query<{ getVaultUserList: Query['getVaultUserList'] }>({
    query: GET_VAULT_USER_LIST,
  });

  // Throw GraphQL errors if present
  if (errors?.length) {
    throw new Error(errors.map(err => err.message).join(', '));
  }

  // Ensure data exists
  if (!data?.getVaultUserList) {
    throw new Error('Failed to fetch computation list: No data returned');
  }

  return data.getVaultUserList;
};
