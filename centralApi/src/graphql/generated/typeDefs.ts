export const typeDefs = `type PublicUser {
  id: String!
  username: String!
  vault: Vault
  vaultStatus: VaultStatus
}

type ActiveParticipant {
  participantId: String!
  kind: String!
  displayName: String!
  userId: String
  vaultId: String
}

type Vault {
  name: String!
  description: String!
  allowedComputations: [ComputationListItem!]!
  datasetMappings: [VaultDatasetMapping!]!
}

type HostedVault {
  id: String!
  serverId: String!
  name: String!
  description: String!
  datasetKey: String!
  allowedComputations: [ComputationListItem!]!
  active: Boolean!
}

type VaultServer {
  id: String!
  userId: String!
  username: String!
  name: String!
  description: String!
  status: VaultStatus
  vaults: [HostedVault!]!
}

type VaultDatasetMapping {
  computationId: String!
  datasetKey: String!
}

input VaultDatasetMappingInput {
  computationId: String!
  datasetKey: String!
}

type VaultDataset {
  key: String!
  path: String!
  label: String
}

input VaultDatasetInput {
  key: String!
  path: String!
  label: String
}

# Vault heartbeat status - reported by vault services
type VaultRunningComputation {
  runId: String!
  consortiumId: String!
  consortiumTitle: String
  runStartedAt: String!
  runningFor: Int!
}

type VaultStatus {
  status: String!
  version: String!
  uptime: Int!
  websocketConnected: Boolean!
  lastHeartbeat: String!
  runningComputations: [VaultRunningComputation!]!
  availableDatasets: [VaultDataset!]!
}

input VaultRunningComputationInput {
  runId: String!
  consortiumId: String!
  startedAt: String!
}

input VaultHeartbeatInput {
  status: String!
  version: String!
  uptime: Int!
  websocketConnected: Boolean!
  runningComputations: [VaultRunningComputationInput!]!
  availableDatasets: [VaultDatasetInput!]!
}

type ConsortiumListItem {
  id: String!
  title: String!
  description: String!
  leader: PublicUser!
  members: [PublicUser!]!
  isPrivate: Boolean!
}

type ComputationListItem {
  id: String!
  title: String!
  imageName: String!
}

input StartRunInput {
  consortiumId: String!
}

type RunStartCentralPayload {
  runId: String!
  imageName: String!
  activeParticipants: [ActiveParticipant!]!
  consortiumId: String!
  computationParameters: String!
}

type RunStartEdgePayload {
  runId: String!
  participantId: String!
  vaultId: String
  computationId: String!
  imageName: String!
  consortiumId: String!
  downloadUrl: String!
  downloadToken: String!
}

type StartRunOutput {
  runId: String!
}

type Computation {
  title: String!
  imageName: String!
  imageDownloadUrl: String!
  notes: String!
  owner: String!
  hasLocalParameters: Boolean!
}

type StudyConfiguration {
  consortiumLeaderNotes: String
  computationParameters: String!
  computation: Computation
}

type ConsortiumDetails {
  id: String!
  title: String!
  description: String!
  leader: PublicUser!
  members: [PublicUser!]!
  activeMembers: [PublicUser!]!
  readyMembers: [PublicUser!]!
  vaultMembers: [HostedVault!]!
  activeVaultMembers: [HostedVault!]!
  readyVaultMembers: [HostedVault!]!
  studyConfiguration: StudyConfiguration!
  isPrivate: Boolean!
}

type LoginOutput {
  accessToken: String!
  userId: String!
  username: String!
  roles: [String!]!
}

type UserProfile {
  userId: String!
  username: String!
  roles: [String!]!
}

type RunEventPayload {
  consortiumId: String!
  consortiumTitle: String!
  runId: String!
  status: String!
  timestamp: String!
}

type RunListItem {
  consortiumId: String!
  consortiumTitle: String!
  runId: String!
  status: String!
  lastUpdated: String!
  createdAt: String!
}

type RunError {
  user: PublicUser!
  timestamp: String!
  message: String!
}

type RunDetailConsortium {
  id: String!
  title: String!
  leader: PublicUser!
  activeMembers: [PublicUser!]!
  readyMembers: [PublicUser!]!
  activeVaultMembers: [HostedVault!]!
  readyVaultMembers: [HostedVault!]!
}

type RunDetails {
  runId: String!
  consortium: RunDetailConsortium!
  status: String!
  lastUpdated: String!
  createdAt: String!
  members: [PublicUser!]!
  vaultMembers: [HostedVault!]!
  studyConfiguration: StudyConfiguration!
  runErrors: [RunError!]!
}

type InviteInfo {
  consortiumName: String!
  leaderName: String!
  isExpired: Boolean!
}

type Query {
  getConsortiumList: [ConsortiumListItem!]!
  getComputationList: [ComputationListItem!]!
  getMyVaultConfig: Vault!
  getMyVaultServerConfig: VaultServer!
  getConsortiumDetails(consortiumId: String!): ConsortiumDetails!
  getComputationDetails(computationId: String!): Computation!
  getRunList(consortiumId: String): [RunListItem!]!
  getRunDetails(runId: String!): RunDetails!
  getVaultUserList: [PublicUser!]!
  getVaultServerList: [VaultServer!]!
  getHostedVaultList(serverId: String): [HostedVault!]!
  getInviteInfo(inviteToken: String!): InviteInfo!
  getUserProfile: UserProfile!
}

type Mutation {
  # used by vault federated clients
  vaultHeartbeat(heartbeat: VaultHeartbeatInput!): Boolean!
  # used by federated clients
  reportRunReady(runId: String!): Boolean!
  reportRunError(runId: String!, errorMessage: String!): Boolean!
  reportRunComplete(runId: String!): Boolean!
  reportRunStatus(runId: String!, status: String!): Boolean!
  # used by desktop App
  login(username: String!, password: String!): LoginOutput!
  startRun(input: StartRunInput!): StartRunOutput!
  studySetComputation(consortiumId: String!, computationId: String!): Boolean!
  studySetParameters(consortiumId: String!, parameters: String!): Boolean!
  studySetNotes(consortiumId: String!, notes: String!): Boolean!
  consortiumCreate(title: String!, description: String, isPrivate: Boolean): String!
  consortiumEdit(consortiumId: String!, title: String!, description: String!, isPrivate: Boolean): Boolean!
  consortiumJoin(consortiumId: String!): Boolean!
  consortiumJoinByInvite(inviteToken: String!): Boolean!
  consortiumDelete(consortiumId: String!): Boolean!
  consortiumLeave(consortiumId: String!): Boolean!
  consortiumSetMemberActive(consortiumId: String!, active: Boolean!): Boolean!
  consortiumSetMemberReady(consortiumId: String!, ready: Boolean!): Boolean!
  consortiumInvite(consortiumId: String!, email: String!): Boolean!
  computationCreate(title: String!, imageName: String!, imageDownloadUrl: String!, notes: String!, hasLocalParameters: Boolean!): Boolean!
  computationEdit(computationId: String!, title: String!, imageName: String!, imageDownloadUrl: String!, notes: String!, hasLocalParameters: Boolean!): Boolean!
  userCreate(username: String!, password: String!): LoginOutput!
  userChangePassword(password: String!): Boolean!
  adminChangeUserRoles(username: String!, roles: [String!]!): Boolean!
  adminChangeUserPassword(username: String!, password: String!): Boolean!
  adminSetVaultAllowedComputations(userId: String!, computationIds: [String!]!): Boolean!
  adminSetVaultDatasetMappings(
    userId: String!
    mappings: [VaultDatasetMappingInput!]!
  ): Boolean!
  adminCreateHostedVault(
    serverId: String!
    name: String!
    description: String!
    datasetKey: String!
  ): String!
  adminSetHostedVaultAllowedComputations(
    vaultId: String!
    computationIds: [String!]!
  ): Boolean!
  leaderAddHostedVault(consortiumId: String!, vaultId: String!): Boolean!
  leaderSetHostedVaultActive(
    consortiumId: String!
    vaultId: String!
    active: Boolean!
  ): Boolean!
  leaderRemoveHostedVault(consortiumId: String!, vaultId: String!): Boolean!
  leaderSetMemberInactive(consortiumId: String!, userId: String!, active: Boolean!): Boolean!
  leaderRemoveMember(consortiumId: String!, userId: String!): Boolean!
  leaderAddVaultUser(consortiumId: String!, userId: String!): Boolean!
  requestPasswordReset(username: String!): Boolean!
  resetPassword(token: String!, newPassword: String!): LoginOutput!
  runDelete(runId: String!): Boolean!
}

type Subscription {
  # used by central federated client
  runStartCentral: RunStartCentralPayload!
  # used by edge federated client
  runStartEdge: RunStartEdgePayload!
  # used by desktop App
  runEvent: RunEventPayload!
  consortiumLatestRunChanged(consortiumId: String!): String!
  consortiumDetailsChanged(consortiumId: String!): String!
  runDetailsChanged(runId: String!): String!
}
`;
