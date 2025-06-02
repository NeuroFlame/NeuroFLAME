import { ApolloClient, gql, NormalizedCacheObject } from '@apollo/client';
import { MutationLeaderSetMemberInactiveArgs } from './generated/graphql'; // Use generated types

export const leaderSetMemberInactive = async (
    apolloClient: ApolloClient<NormalizedCacheObject>,
    input: MutationLeaderSetMemberInactiveArgs // Use MutationleaderSetMemberInactiveArgs type for input
): Promise<void> => {
    const LEADER_SET_MEMBER_INACTIVE_MUTATION = gql`
    mutation leaderSetMemberInactive($consortiumId: String!,  $userId: String!) {
      leaderSetMemberInactive(consortiumId: $consortiumId, userId: $userId)
    }
  `;

    const { data, errors } = await apolloClient.mutate<{ leaderSetMemberInactive: void }>({
        mutation: LEADER_SET_MEMBER_INACTIVE_MUTATION,
        variables: input, // Pass input directly
    });

    // Throw GraphQL errors if present
    if (errors?.length) {
        throw new Error(errors.map(err => err.message).join(', '));
    }

    // Ensure leaderSetMemberInactive data exists
    if (!data?.leaderSetMemberInactive) {
        throw new Error('leaderSetMemberInactive failed: No data returned');
    }

    return data.leaderSetMemberInactive;
};
