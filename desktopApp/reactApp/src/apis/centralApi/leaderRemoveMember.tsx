import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client';
import { MutationLeaderRemoveMemberArgs } from './generated/graphql'; // Use generated types

export const leaderRemoveMember = async (
    apolloClient: ApolloClient<NormalizedCacheObject>,
    input: MutationLeaderRemoveMemberArgs // Use MutationleaderRemoveMemberArgs type for input
): Promise<void> => {
    const LEADER_REMOVE_MEMBER_MUTATION = gql`
    mutation leaderRemoveMember($consortiumId: String!,  $userId: String!) {
      leaderRemoveMember(consortiumId: $consortiumId, userId: $userId)
    }
  `;

    const { data, errors } = await apolloClient.mutate<{ leaderRemoveMember: void }>({
        mutation: LEADER_REMOVE_MEMBER_MUTATION,
        variables: input, // Pass input directly
    });

    // Throw GraphQL errors if present
    if (errors?.length) {
        throw new Error(errors.map(err => err.message).join(', '));
    }

    // Ensure leaderRemoveMember data exists
    if (!data?.leaderRemoveMember) {
        throw new Error('leaderRemoveMember failed: No data returned');
    }

    return data.leaderRemoveMember;
};
