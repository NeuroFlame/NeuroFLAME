import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client';
import { MutationLeaderAddVaultUserArgs } from './generated/graphql'; // Use generated types

export const leaderAddVaultUser = async (
    apolloClient: ApolloClient<NormalizedCacheObject>,
    input: MutationLeaderAddVaultUserArgs // Use MutationLeaderAddVaultUserArgs type for input
): Promise<void> => {
    const LEADER_ADD_VAULT_USER_MUTATION = gql`
    mutation leaderAddVaultUser($consortiumId: String!,  $userId: String!) {
      leaderAddVaultUser(consortiumId: $consortiumId, userId: $userId)
    }
  `;

    const { data, errors } = await apolloClient.mutate<{ leaderAddVaultUser: void }>({
        mutation: LEADER_ADD_VAULT_USER_MUTATION,
        variables: input, // Pass input directly
    });

    // Throw GraphQL errors if present
    if (errors?.length) {
        throw new Error(errors.map(err => err.message).join(', '));
    }

    // Ensure leaderAddVaultUser data exists
    if (!data?.leaderAddVaultUser) {
        throw new Error('leaderAddVaultUser failed: No data returned');
    }

    return data.leaderAddVaultUser;
};
