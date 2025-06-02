import { useApolloClients } from "../../contexts/ApolloClientsContext";
import { login } from "./login";
import { getConsortiumList } from "./getConsortiumList";
import { getConsortiumDetails } from "./getConsortiumDetails";
import { getRunDetails } from "./getRunDetails";
import { studySetParameters } from "./studySetParameters";
import { getComputationList } from "./getComputationList";
import { studySetComputation } from "./studySetComputation";
import { consortiumSetMemberActive } from "./consortiumSetMemberActive";
import { startRun } from "./startRun";
import { studySetNotes } from "./studySetNotes";
import { consortiumDetailsChanged } from "./subscriptions/consortiumDetailsChanged";
import { getRunList } from "./getRunList";
import { consortiumLatestRunChanged } from "./subscriptions/consortiumLatestRunChanged";
import { runDetailsChanged } from "./subscriptions/runDetailsChanged";
import { consortiumSetMemberReady } from "./consortiumSetMemberReady";

// New imports
import { adminChangeUserPassword } from "./adminChangeUserPassword";
import { adminChangeUserRoles } from "./adminChangeUserRoles";
import { computationCreate } from "./computationCreate";
import { computationEdit } from "./computationEdit";
import { consortiumCreate } from "./consortiumCreate";
import { consortiumEdit } from "./consortiumEdit";
import { consortiumJoin } from "./consortiumJoin";
import { consortiumLeave } from "./consortiumLeave";
import { userChangePassword } from "./userChangePassword";
import { userCreate } from "./userCreate";
import { getComputationDetails } from "./getComputationDetails";

// Import generated types
import { 
    MutationAdminChangeUserPasswordArgs,
    MutationAdminChangeUserRolesArgs,
    MutationComputationCreateArgs,
    MutationComputationEditArgs,
    MutationConsortiumCreateArgs,
    MutationConsortiumEditArgs,
    MutationConsortiumJoinArgs,
    MutationConsortiumLeaveArgs,
    MutationUserChangePasswordArgs,
    MutationUserCreateArgs,
    QueryGetComputationDetailsArgs,
    QueryGetRunListArgs,
    QueryGetRunDetailsArgs,
    QueryGetConsortiumDetailsArgs,
    MutationLoginArgs,
    MutationStudySetParametersArgs,
    MutationStudySetComputationArgs,
    MutationConsortiumSetMemberActiveArgs,
    MutationConsortiumSetMemberReadyArgs,
    MutationStartRunArgs,
    MutationStudySetNotesArgs,
    MutationLeaderAddVaultUserArgs,
    MutationLeaderRemoveMemberArgs,
    MutationLeaderSetMemberInactiveArgs

} from "./generated/graphql";
import { getVaultUserList } from "./getVaultUserList";
import { leaderAddVaultUser } from "./leaderAddVaultUser";
import { leaderRemoveMember } from "./leaderRemoveMember";
import { leaderSetMemberInactive } from "./leaderSetMemberInactive";

export const useCentralApi = () => {
    const { centralApiApolloClient } = useApolloClients();

    // Handle Apollo Client being undefined
    if (!centralApiApolloClient) {
        throw new Error("Apollo Client is not defined");
    }

    return {
        // Existing methods
        getConsortiumList: () => getConsortiumList(centralApiApolloClient),
        getComputationList: () => getComputationList(centralApiApolloClient),
        getConsortiumDetails: (input: QueryGetConsortiumDetailsArgs) => getConsortiumDetails(centralApiApolloClient, input),
        getRunDetails: (input: QueryGetRunDetailsArgs) => getRunDetails(centralApiApolloClient, input),
        login: (input: MutationLoginArgs) => login(centralApiApolloClient, input),
        studySetParameters: (input: MutationStudySetParametersArgs) => studySetParameters(centralApiApolloClient, input),
        studySetComputation: (input: MutationStudySetComputationArgs) => studySetComputation(centralApiApolloClient, input),
        consortiumSetMemberActive: (input: MutationConsortiumSetMemberActiveArgs) => consortiumSetMemberActive(centralApiApolloClient, input),
        consortiumSetMemberReady: (input: MutationConsortiumSetMemberReadyArgs) => consortiumSetMemberReady(centralApiApolloClient, input),
        startRun: (input: MutationStartRunArgs) => startRun(centralApiApolloClient, input),
        studySetNotes: (input: MutationStudySetNotesArgs) => studySetNotes(centralApiApolloClient, input),
        getRunList: (input: QueryGetRunListArgs) => getRunList(centralApiApolloClient, input),
        adminChangeUserPassword: (input: MutationAdminChangeUserPasswordArgs) => adminChangeUserPassword(centralApiApolloClient, input),
        adminChangeUserRoles: (input: MutationAdminChangeUserRolesArgs) => adminChangeUserRoles(centralApiApolloClient, input),
        computationCreate: (input: MutationComputationCreateArgs) => computationCreate(centralApiApolloClient, input),
        computationEdit: (input: MutationComputationEditArgs) => computationEdit(centralApiApolloClient, input),
        consortiumCreate: (input: MutationConsortiumCreateArgs) => consortiumCreate(centralApiApolloClient, input),
        consortiumEdit: (input: MutationConsortiumEditArgs) => consortiumEdit(centralApiApolloClient, input),
        consortiumJoin: (input: MutationConsortiumJoinArgs) => consortiumJoin(centralApiApolloClient, input),
        consortiumLeave: (input: MutationConsortiumLeaveArgs) => consortiumLeave(centralApiApolloClient, input),
        userChangePassword: (input: MutationUserChangePasswordArgs) => userChangePassword(centralApiApolloClient, input),
        userCreate: (input: MutationUserCreateArgs) => userCreate(centralApiApolloClient, input),
        getComputationDetails: (input: QueryGetComputationDetailsArgs) => getComputationDetails(centralApiApolloClient, input),
        getVaultUserList: () => getVaultUserList(centralApiApolloClient),
        leaderAddVaultUser: (input: MutationLeaderAddVaultUserArgs) => leaderAddVaultUser(centralApiApolloClient, input),
        leaderRemoveMember: (input: MutationLeaderRemoveMemberArgs) => leaderRemoveMember(centralApiApolloClient, input),
        leaderSetMemberInactive: (input: MutationLeaderSetMemberInactiveArgs) => leaderSetMemberInactive(centralApiApolloClient, input),

        subscriptions: {
            consortiumDetailsChanged: (input: { consortiumId: string }) => consortiumDetailsChanged(centralApiApolloClient, input),
            consortiumLatestRunChanged: (input: { consortiumId: string }) => consortiumLatestRunChanged(centralApiApolloClient, input),
            runDetailsChanged: (input: { runId: string }) => runDetailsChanged(centralApiApolloClient, input)
        }
    };
};
