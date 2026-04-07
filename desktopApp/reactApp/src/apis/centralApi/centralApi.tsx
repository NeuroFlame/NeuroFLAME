import { useMemo } from 'react'
import { useApolloClients } from '../../contexts/ApolloClientsContext'
import { login } from './login'
import { getConsortiumList } from './getConsortiumList'
import { getConsortiumDetails } from './getConsortiumDetails'
import { getRunDetails } from './getRunDetails'
import { studySetParameters } from './studySetParameters'
import { getComputationList } from './getComputationList'
import { studySetComputation } from './studySetComputation'
import { consortiumSetMemberActive } from './consortiumSetMemberActive'
import { startRun } from './startRun'
import { studySetNotes } from './studySetNotes'
import { consortiumDetailsChanged } from './subscriptions/consortiumDetailsChanged'
import { getRunList } from './getRunList'
import { runDelete } from './runDelete'
import { consortiumLatestRunChanged } from './subscriptions/consortiumLatestRunChanged'
import { runDetailsChanged } from './subscriptions/runDetailsChanged'
import { consortiumSetMemberReady } from './consortiumSetMemberReady'

// New imports
import { adminChangeUserPassword } from './adminChangeUserPassword'
import { adminChangeUserRoles } from './adminChangeUserRoles'
import { adminCreateHostedVault } from './adminCreateHostedVault'
import { adminSetHostedVaultAllowedComputations } from './adminSetHostedVaultAllowedComputations'
import { adminSetVaultAllowedComputations } from './adminSetVaultAllowedComputations'
import { adminSetVaultDatasetMappings } from './adminSetVaultDatasetMappings'
import { computationCreate } from './computationCreate'
import { computationEdit } from './computationEdit'
import { consortiumCreate } from './consortiumCreate'
import { consortiumDelete } from './consortiumDelete'
import { consortiumEdit } from './consortiumEdit'
import { consortiumInvite } from './consortiumInvite'
import { consortiumJoin } from './consortiumJoin'
import { consortiumJoinByInvite } from './consortiumJoinByInvite'
import { consortiumLeave } from './consortiumLeave'
import { userChangePassword } from './userChangePassword'
import { userCreate } from './userCreate'
import { getComputationDetails } from './getComputationDetails'
import { requestPasswordReset } from './requestPasswordReset'
import { resetPassword } from './resetPassword'

// Import generated types
import {
  MutationLeaderAddHostedVaultArgs,
  MutationAdminCreateHostedVaultArgs,
  MutationAdminChangeUserPasswordArgs,
  MutationAdminChangeUserRolesArgs,
  MutationAdminSetHostedVaultAllowedComputationsArgs,
  MutationAdminSetVaultAllowedComputationsArgs,
  MutationAdminSetVaultDatasetMappingsArgs,
  MutationComputationCreateArgs,
  MutationComputationEditArgs,
  MutationConsortiumCreateArgs,
  MutationConsortiumEditArgs,
  MutationConsortiumDeleteArgs,
  MutationConsortiumInviteArgs,
  MutationConsortiumJoinArgs,
  MutationConsortiumJoinByInviteArgs,
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
  MutationLeaderRemoveHostedVaultArgs,
  MutationLeaderSetHostedVaultActiveArgs,
  MutationLeaderAddVaultUserArgs,
  MutationLeaderRemoveMemberArgs,
  MutationLeaderSetMemberInactiveArgs,
  MutationRequestPasswordResetArgs,
  MutationResetPasswordArgs,
  MutationRunDeleteArgs,
  QueryGetHostedVaultListArgs,
} from './generated/graphql'
import { getHostedVaultList } from './getHostedVaultList'
import { getVaultServerList } from './getVaultServerList'
import { getVaultUserList } from './getVaultUserList'
import { leaderAddHostedVault } from './leaderAddHostedVault'
import { leaderRemoveHostedVault } from './leaderRemoveHostedVault'
import { leaderSetHostedVaultActive } from './leaderSetHostedVaultActive'
import { leaderAddVaultUser } from './leaderAddVaultUser'
import { leaderRemoveMember } from './leaderRemoveMember'
import { leaderSetMemberInactive } from './leaderSetMemberInactive'

export const useCentralApi = () => {
  const { centralApiApolloClient } = useApolloClients()

  // Handle Apollo Client being undefined
  if (!centralApiApolloClient) {
    throw new Error('Apollo Client is not defined')
  }

  return useMemo(() => ({
    getConsortiumList: () => getConsortiumList(centralApiApolloClient),
    getComputationList: () => getComputationList(centralApiApolloClient),
    getConsortiumDetails: (input: QueryGetConsortiumDetailsArgs) =>
      getConsortiumDetails(centralApiApolloClient, input),
    getRunDetails: (input: QueryGetRunDetailsArgs) =>
      getRunDetails(centralApiApolloClient, input),
    login: (input: MutationLoginArgs) => login(centralApiApolloClient, input),
    studySetParameters: (input: MutationStudySetParametersArgs) =>
      studySetParameters(centralApiApolloClient, input),
    studySetComputation: (input: MutationStudySetComputationArgs) =>
      studySetComputation(centralApiApolloClient, input),
    consortiumSetMemberActive: (input: MutationConsortiumSetMemberActiveArgs) =>
      consortiumSetMemberActive(centralApiApolloClient, input),
    consortiumSetMemberReady: (input: MutationConsortiumSetMemberReadyArgs) =>
      consortiumSetMemberReady(centralApiApolloClient, input),
    consortiumInvite: (input: MutationConsortiumInviteArgs) =>
      consortiumInvite(centralApiApolloClient, input),
    startRun: (input: MutationStartRunArgs) =>
      startRun(centralApiApolloClient, input),
    studySetNotes: (input: MutationStudySetNotesArgs) =>
      studySetNotes(centralApiApolloClient, input),
    getRunList: (input: QueryGetRunListArgs) =>
      getRunList(centralApiApolloClient, input),
    runDelete: (input: MutationRunDeleteArgs) =>
      runDelete(centralApiApolloClient, input),
    adminChangeUserPassword: (input: MutationAdminChangeUserPasswordArgs) =>
      adminChangeUserPassword(centralApiApolloClient, input),
    adminChangeUserRoles: (input: MutationAdminChangeUserRolesArgs) =>
      adminChangeUserRoles(centralApiApolloClient, input),
    adminCreateHostedVault: (input: MutationAdminCreateHostedVaultArgs) =>
      adminCreateHostedVault(centralApiApolloClient, input),
    adminSetHostedVaultAllowedComputations: (
      input: MutationAdminSetHostedVaultAllowedComputationsArgs,
    ) => adminSetHostedVaultAllowedComputations(centralApiApolloClient, input),
    adminSetVaultAllowedComputations: (
      input: MutationAdminSetVaultAllowedComputationsArgs,
    ) => adminSetVaultAllowedComputations(centralApiApolloClient, input),
    adminSetVaultDatasetMappings: (
      input: MutationAdminSetVaultDatasetMappingsArgs,
    ) => adminSetVaultDatasetMappings(centralApiApolloClient, input),
    computationCreate: (input: MutationComputationCreateArgs) =>
      computationCreate(centralApiApolloClient, input),
    computationEdit: (input: MutationComputationEditArgs) =>
      computationEdit(centralApiApolloClient, input),
    consortiumCreate: (input: MutationConsortiumCreateArgs) =>
      consortiumCreate(centralApiApolloClient, input),
    consortiumEdit: (input: MutationConsortiumEditArgs) =>
      consortiumEdit(centralApiApolloClient, input),
    consortiumDelete: (input: MutationConsortiumDeleteArgs) =>
      consortiumDelete(centralApiApolloClient, input),
    consortiumJoin: (input: MutationConsortiumJoinArgs) =>
      consortiumJoin(centralApiApolloClient, input),
    consortiumJoinByInvite: (input: MutationConsortiumJoinByInviteArgs) =>
      consortiumJoinByInvite(centralApiApolloClient, input),
    consortiumLeave: (input: MutationConsortiumLeaveArgs) =>
      consortiumLeave(centralApiApolloClient, input),
    userChangePassword: (input: MutationUserChangePasswordArgs) =>
      userChangePassword(centralApiApolloClient, input),
    userCreate: (input: MutationUserCreateArgs) =>
      userCreate(centralApiApolloClient, input),
    getComputationDetails: (input: QueryGetComputationDetailsArgs) =>
      getComputationDetails(centralApiApolloClient, input),
    getHostedVaultList: (input: QueryGetHostedVaultListArgs) =>
      getHostedVaultList(centralApiApolloClient, input),
    getVaultServerList: () => getVaultServerList(centralApiApolloClient),
    getVaultUserList: () => getVaultUserList(centralApiApolloClient),
    leaderAddHostedVault: (input: MutationLeaderAddHostedVaultArgs) =>
      leaderAddHostedVault(centralApiApolloClient, input),
    leaderSetHostedVaultActive: (input: MutationLeaderSetHostedVaultActiveArgs) =>
      leaderSetHostedVaultActive(centralApiApolloClient, input),
    leaderRemoveHostedVault: (input: MutationLeaderRemoveHostedVaultArgs) =>
      leaderRemoveHostedVault(centralApiApolloClient, input),
    leaderAddVaultUser: (input: MutationLeaderAddVaultUserArgs) =>
      leaderAddVaultUser(centralApiApolloClient, input),
    leaderRemoveMember: (input: MutationLeaderRemoveMemberArgs) =>
      leaderRemoveMember(centralApiApolloClient, input),
    leaderSetMemberInactive: (input: MutationLeaderSetMemberInactiveArgs) =>
      leaderSetMemberInactive(centralApiApolloClient, input),
    requestPasswordReset: (input: MutationRequestPasswordResetArgs) =>
      requestPasswordReset(centralApiApolloClient, input),
    resetPassword: (input: MutationResetPasswordArgs) =>
      resetPassword(centralApiApolloClient, input),
    subscriptions: {
      consortiumDetailsChanged: (input: { consortiumId: string }) =>
        consortiumDetailsChanged(centralApiApolloClient, input),
      consortiumLatestRunChanged: (input: { consortiumId: string }) =>
        consortiumLatestRunChanged(centralApiApolloClient, input),
      runDetailsChanged: (input: { runId: string }) =>
        runDetailsChanged(centralApiApolloClient, input),
    },
  }), [centralApiApolloClient])
}
