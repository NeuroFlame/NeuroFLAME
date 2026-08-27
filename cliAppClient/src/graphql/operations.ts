// Every GraphQL document + payload type the CLI uses against centralApi,
// in one place, grouped by resource. This mirrors centralApi's typeDefs.graphql
// field-for-field; see that file as the source of truth if the two drift.
//
// Deliberately excluded: vaultHeartbeat, reportRunReady/Error/Complete/Status,
// and the runStartCentral/runStartEdge subscriptions. Those are used
// internally by edgeFederatedClient/vaultFederatedClient, not by a human
// operator, so they have no command here.

// ---------------------------------------------------------------------------
// Shared shapes
// ---------------------------------------------------------------------------

export interface PublicUser {
  id: string
  username: string
}

export interface ComputationListItem {
  id: string
  title: string
  imageName: string
}

export interface Computation {
  title: string
  imageName: string
  imageDownloadUrl: string
  notes: string
  owner: string
  hasLocalParameters: boolean
}

export interface StudyConfiguration {
  consortiumLeaderNotes: string | null
  computationParameters: string
  computation: Computation | null
}

export interface ConsortiumListItem {
  id: string
  title: string
  description: string
  isPrivate: boolean
  leader: PublicUser
  members: PublicUser[]
}

export interface HostedVault {
  id: string
  serverId: string
  name: string
  description: string
  datasetKey: string
  allowedComputations: ComputationListItem[]
  active: boolean
}

export interface ConsortiumDetails {
  id: string
  title: string
  description: string
  isPrivate: boolean
  leader: PublicUser
  members: PublicUser[]
  activeMembers: PublicUser[]
  readyMembers: PublicUser[]
  vaultMembers: HostedVault[]
  activeVaultMembers: HostedVault[]
  readyVaultMembers: HostedVault[]
  studyConfiguration: StudyConfiguration
}

export interface RunListItem {
  consortiumId: string
  consortiumTitle: string
  runId: string
  status: string
  lastUpdated: string
  createdAt: string
}

export interface RunError {
  user: PublicUser
  timestamp: string
  message: string
}

export interface RunDetailConsortium {
  id: string
  title: string
  leader: PublicUser
  activeMembers: PublicUser[]
  readyMembers: PublicUser[]
  activeVaultMembers: HostedVault[]
  readyVaultMembers: HostedVault[]
}

export interface RunDetails {
  runId: string
  consortium: RunDetailConsortium
  status: string
  lastUpdated: string
  createdAt: string
  members: PublicUser[]
  vaultMembers: HostedVault[]
  studyConfiguration: StudyConfiguration
  runErrors: RunError[]
}

export interface VaultStatus {
  status: string
  version: string
  uptime: number
  websocketConnected: boolean
  lastHeartbeat: string
  runningComputations: {
    runId: string
    consortiumId: string
    consortiumTitle: string | null
    runStartedAt: string
    runningFor: number
  }[]
  availableDatasets: { key: string; path: string; label: string | null }[]
}

export interface Vault {
  name: string
  description: string
  allowedComputations: ComputationListItem[]
  datasetMappings: { computationId: string; datasetKey: string }[]
}

export interface VaultServer {
  id: string
  userId: string
  username: string
  name: string
  description: string
  status: VaultStatus | null
  vaults: HostedVault[]
}

export interface InviteInfo {
  consortiumName: string
  leaderName: string
  isExpired: boolean
}

export interface LoginOutput {
  accessToken: string
  userId: string
  username: string
  roles: string[]
}

export interface UserProfile {
  userId: string
  username: string
  roles: string[]
}

// ---------------------------------------------------------------------------
// Auth / user
// ---------------------------------------------------------------------------

export const LOGIN_MUTATION = `
  mutation login($username: String!, $password: String!) {
    login(username: $username, password: $password) {
      accessToken
      userId
      username
      roles
    }
  }
`

export const GET_USER_PROFILE_QUERY = `
  query {
    getUserProfile { userId username roles }
  }
`

export const USER_CREATE_MUTATION = `
  mutation userCreate($username: String!, $password: String!) {
    userCreate(username: $username, password: $password) {
      accessToken
      userId
      username
      roles
    }
  }
`

export const USER_CHANGE_PASSWORD_MUTATION = `
  mutation userChangePassword($password: String!) {
    userChangePassword(password: $password)
  }
`

export const REQUEST_PASSWORD_RESET_MUTATION = `
  mutation requestPasswordReset($username: String!) {
    requestPasswordReset(username: $username)
  }
`

export const RESET_PASSWORD_MUTATION = `
  mutation resetPassword($token: String!, $newPassword: String!) {
    resetPassword(token: $token, newPassword: $newPassword) {
      accessToken
      userId
      username
      roles
    }
  }
`

// ---------------------------------------------------------------------------
// Consortium
// ---------------------------------------------------------------------------

export const GET_CONSORTIUM_LIST_QUERY = `
  query {
    getConsortiumList {
      id
      title
      description
      isPrivate
      leader { id username }
      members { id username }
    }
  }
`

export const GET_CONSORTIUM_DETAILS_QUERY = `
  query consortiumDetails($consortiumId: String!) {
    getConsortiumDetails(consortiumId: $consortiumId) {
      id
      title
      description
      isPrivate
      leader { id username }
      members { id username }
      activeMembers { id username }
      readyMembers { id username }
      vaultMembers { id name active }
      activeVaultMembers { id name active }
      readyVaultMembers { id name active }
      studyConfiguration {
        consortiumLeaderNotes
        computationParameters
        computation { title imageName imageDownloadUrl notes owner hasLocalParameters }
      }
    }
  }
`

export const CONSORTIUM_CREATE_MUTATION = `
  mutation consortiumCreate($title: String!, $description: String, $isPrivate: Boolean) {
    consortiumCreate(title: $title, description: $description, isPrivate: $isPrivate)
  }
`

export const CONSORTIUM_EDIT_MUTATION = `
  mutation consortiumEdit($consortiumId: String!, $title: String!, $description: String!, $isPrivate: Boolean) {
    consortiumEdit(consortiumId: $consortiumId, title: $title, description: $description, isPrivate: $isPrivate)
  }
`

export const CONSORTIUM_JOIN_MUTATION = `
  mutation consortiumJoin($consortiumId: String!) {
    consortiumJoin(consortiumId: $consortiumId)
  }
`

export const CONSORTIUM_JOIN_BY_INVITE_MUTATION = `
  mutation consortiumJoinByInvite($inviteToken: String!) {
    consortiumJoinByInvite(inviteToken: $inviteToken)
  }
`

export const CONSORTIUM_DELETE_MUTATION = `
  mutation consortiumDelete($consortiumId: String!) {
    consortiumDelete(consortiumId: $consortiumId)
  }
`

export const CONSORTIUM_LEAVE_MUTATION = `
  mutation consortiumLeave($consortiumId: String!) {
    consortiumLeave(consortiumId: $consortiumId)
  }
`

export const CONSORTIUM_SET_MEMBER_ACTIVE_MUTATION = `
  mutation consortiumSetMemberActive($consortiumId: String!, $active: Boolean!) {
    consortiumSetMemberActive(consortiumId: $consortiumId, active: $active)
  }
`

export const CONSORTIUM_SET_MEMBER_READY_MUTATION = `
  mutation consortiumSetMemberReady($consortiumId: String!, $ready: Boolean!) {
    consortiumSetMemberReady(consortiumId: $consortiumId, ready: $ready)
  }
`

export const CONSORTIUM_INVITE_MUTATION = `
  mutation consortiumInvite($consortiumId: String!, $email: String!) {
    consortiumInvite(consortiumId: $consortiumId, email: $email)
  }
`

export const GET_INVITE_INFO_QUERY = `
  query getInviteInfo($inviteToken: String!) {
    getInviteInfo(inviteToken: $inviteToken) {
      consortiumName
      leaderName
      isExpired
    }
  }
`

export const LEADER_ADD_HOSTED_VAULT_MUTATION = `
  mutation leaderAddHostedVault($consortiumId: String!, $vaultId: String!) {
    leaderAddHostedVault(consortiumId: $consortiumId, vaultId: $vaultId)
  }
`

export const LEADER_SET_HOSTED_VAULT_ACTIVE_MUTATION = `
  mutation leaderSetHostedVaultActive($consortiumId: String!, $vaultId: String!, $active: Boolean!) {
    leaderSetHostedVaultActive(consortiumId: $consortiumId, vaultId: $vaultId, active: $active)
  }
`

export const LEADER_REMOVE_HOSTED_VAULT_MUTATION = `
  mutation leaderRemoveHostedVault($consortiumId: String!, $vaultId: String!) {
    leaderRemoveHostedVault(consortiumId: $consortiumId, vaultId: $vaultId)
  }
`

export const LEADER_SET_MEMBER_INACTIVE_MUTATION = `
  mutation leaderSetMemberInactive($consortiumId: String!, $userId: String!, $active: Boolean!) {
    leaderSetMemberInactive(consortiumId: $consortiumId, userId: $userId, active: $active)
  }
`

export const LEADER_REMOVE_MEMBER_MUTATION = `
  mutation leaderRemoveMember($consortiumId: String!, $userId: String!) {
    leaderRemoveMember(consortiumId: $consortiumId, userId: $userId)
  }
`

export const LEADER_ADD_VAULT_USER_MUTATION = `
  mutation leaderAddVaultUser($consortiumId: String!, $userId: String!) {
    leaderAddVaultUser(consortiumId: $consortiumId, userId: $userId)
  }
`

export const CONSORTIUM_DETAILS_CHANGED_SUBSCRIPTION = `
  subscription consortiumDetailsChanged($consortiumId: String!) {
    consortiumDetailsChanged(consortiumId: $consortiumId)
  }
`

// Fires on every run-status transition for this consortium (Provisioning,
// Starting, In Progress, Complete, Error) as well as a new run starting —
// see centralApi's resolvers.ts, which publishes it alongside every
// RUN_EVENT. Lets a consortium be watched without knowing a run id ahead of
// time, unlike RUN_EVENT_SUBSCRIPTION (used by `run watch`) which needs one.
export const CONSORTIUM_LATEST_RUN_CHANGED_SUBSCRIPTION = `
  subscription consortiumLatestRunChanged($consortiumId: String!) {
    consortiumLatestRunChanged(consortiumId: $consortiumId)
  }
`

// ---------------------------------------------------------------------------
// Computation
// ---------------------------------------------------------------------------

export const GET_COMPUTATION_LIST_QUERY = `
  query {
    getComputationList { id title imageName }
  }
`

export const GET_COMPUTATION_DETAILS_QUERY = `
  query computationDetails($computationId: String!) {
    getComputationDetails(computationId: $computationId) {
      title
      imageName
      imageDownloadUrl
      notes
      owner
      hasLocalParameters
    }
  }
`

export const COMPUTATION_CREATE_MUTATION = `
  mutation computationCreate(
    $title: String!
    $imageName: String!
    $imageDownloadUrl: String!
    $notes: String!
    $hasLocalParameters: Boolean!
  ) {
    computationCreate(
      title: $title
      imageName: $imageName
      imageDownloadUrl: $imageDownloadUrl
      notes: $notes
      hasLocalParameters: $hasLocalParameters
    )
  }
`

export const COMPUTATION_EDIT_MUTATION = `
  mutation computationEdit(
    $computationId: String!
    $title: String!
    $imageName: String!
    $imageDownloadUrl: String!
    $notes: String!
    $hasLocalParameters: Boolean!
  ) {
    computationEdit(
      computationId: $computationId
      title: $title
      imageName: $imageName
      imageDownloadUrl: $imageDownloadUrl
      notes: $notes
      hasLocalParameters: $hasLocalParameters
    )
  }
`

// ---------------------------------------------------------------------------
// Study
// ---------------------------------------------------------------------------

export const STUDY_SET_COMPUTATION_MUTATION = `
  mutation studySetComputation($consortiumId: String!, $computationId: String!) {
    studySetComputation(consortiumId: $consortiumId, computationId: $computationId)
  }
`

export const STUDY_SET_PARAMETERS_MUTATION = `
  mutation studySetParameters($consortiumId: String!, $parameters: String!) {
    studySetParameters(consortiumId: $consortiumId, parameters: $parameters)
  }
`

export const STUDY_SET_NOTES_MUTATION = `
  mutation studySetNotes($consortiumId: String!, $notes: String!) {
    studySetNotes(consortiumId: $consortiumId, notes: $notes)
  }
`

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

export const START_RUN_MUTATION = `
  mutation startRun($input: StartRunInput!) {
    startRun(input: $input) { runId }
  }
`

export const GET_RUN_LIST_QUERY = `
  query getRunList($consortiumId: String) {
    getRunList(consortiumId: $consortiumId) {
      consortiumId
      consortiumTitle
      runId
      status
      lastUpdated
      createdAt
    }
  }
`

export const GET_RUN_DETAILS_QUERY = `
  query runDetails($runId: String!) {
    getRunDetails(runId: $runId) {
      runId
      status
      lastUpdated
      createdAt
      consortium { id title leader { id username } }
      members { id username }
      vaultMembers { id name active }
      studyConfiguration {
        consortiumLeaderNotes
        computationParameters
        computation { title imageName }
      }
      runErrors { timestamp message user { id username } }
    }
  }
`

export const RUN_DELETE_MUTATION = `
  mutation runDelete($runId: String!) {
    runDelete(runId: $runId)
  }
`

export const RUN_EVENT_SUBSCRIPTION = `
  subscription {
    runEvent { runId status consortiumTitle timestamp }
  }
`

export interface RunEvent {
  runId: string
  status: string
  consortiumTitle: string
  timestamp: string
}

// ---------------------------------------------------------------------------
// Vault (self-service — a vault-role user inspecting its own config)
// ---------------------------------------------------------------------------

export const GET_MY_VAULT_CONFIG_QUERY = `
  query {
    getMyVaultConfig {
      name
      description
      allowedComputations { id title imageName }
      datasetMappings { computationId datasetKey }
    }
  }
`

export const GET_MY_VAULT_SERVER_CONFIG_QUERY = `
  query {
    getMyVaultServerConfig {
      id
      userId
      username
      name
      description
      status {
        status
        version
        uptime
        websocketConnected
        lastHeartbeat
        availableDatasets { key path label }
        runningComputations { runId consortiumId consortiumTitle runStartedAt runningFor }
      }
      vaults { id name description datasetKey active }
    }
  }
`

// ---------------------------------------------------------------------------
// Vault / admin (leader & admin role queries + mutations)
// ---------------------------------------------------------------------------

export const GET_VAULT_USER_LIST_QUERY = `
  query { getVaultUserList { id username } }
`

export const GET_VAULT_SERVER_LIST_QUERY = `
  query {
    getVaultServerList {
      id
      userId
      username
      name
      description
      status {
        status
        version
        uptime
        websocketConnected
        lastHeartbeat
        availableDatasets { key path label }
        runningComputations { runId consortiumId consortiumTitle runStartedAt runningFor }
      }
      vaults { id name description datasetKey active }
    }
  }
`

export const GET_HOSTED_VAULT_LIST_QUERY = `
  query getHostedVaultList($serverId: String) {
    getHostedVaultList(serverId: $serverId) {
      id
      serverId
      name
      description
      datasetKey
      active
      allowedComputations { id title imageName }
    }
  }
`

export const ADMIN_CREATE_VAULT_USER_MUTATION = `
  mutation adminCreateVaultUser($username: String!, $password: String!) {
    adminCreateVaultUser(username: $username, password: $password) {
      accessToken
      userId
      username
      roles
    }
  }
`

export const ADMIN_CHANGE_USER_ROLES_MUTATION = `
  mutation adminChangeUserRoles($username: String!, $roles: [String!]!) {
    adminChangeUserRoles(username: $username, roles: $roles)
  }
`

export const ADMIN_CHANGE_USER_PASSWORD_MUTATION = `
  mutation adminChangeUserPassword($username: String!, $password: String!) {
    adminChangeUserPassword(username: $username, password: $password)
  }
`

export const ADMIN_SET_VAULT_ALLOWED_COMPUTATIONS_MUTATION = `
  mutation adminSetVaultAllowedComputations($userId: String!, $computationIds: [String!]!) {
    adminSetVaultAllowedComputations(userId: $userId, computationIds: $computationIds)
  }
`

export const ADMIN_SET_VAULT_DATASET_MAPPINGS_MUTATION = `
  mutation adminSetVaultDatasetMappings($userId: String!, $mappings: [VaultDatasetMappingInput!]!) {
    adminSetVaultDatasetMappings(userId: $userId, mappings: $mappings)
  }
`

export const ADMIN_CREATE_HOSTED_VAULT_MUTATION = `
  mutation adminCreateHostedVault($serverId: String!, $name: String!, $description: String!, $datasetKey: String!) {
    adminCreateHostedVault(serverId: $serverId, name: $name, description: $description, datasetKey: $datasetKey)
  }
`

export const ADMIN_UPDATE_HOSTED_VAULT_MUTATION = `
  mutation adminUpdateHostedVault($vaultId: String!, $name: String!, $description: String!) {
    adminUpdateHostedVault(vaultId: $vaultId, name: $name, description: $description)
  }
`

export const ADMIN_SET_HOSTED_VAULT_ALLOWED_COMPUTATIONS_MUTATION = `
  mutation adminSetHostedVaultAllowedComputations($vaultId: String!, $computationIds: [String!]!) {
    adminSetHostedVaultAllowedComputations(vaultId: $vaultId, computationIds: $computationIds)
  }
`

// ---------------------------------------------------------------------------
// Edge client (local) — NOT centralApi. This is the "Data Directory" panel's
// backend: a per-consortium local mount path + local parameters file, read
// and written on whichever machine is actually running the edge federated
// client (standalone, or embedded in the desktop app). It has its own
// GraphQL endpoint (edgeFederatedClient/src/api), separate from centralApi,
// but accepts the same access token — it validates by round-tripping the
// token through centralApi's authenticationEndpoint rather than checking a
// local secret, so a `neuroflame login` session works here unchanged.
// ---------------------------------------------------------------------------

export const EDGE_GET_MOUNT_DIR_QUERY = `
  query getMountDir($consortiumId: String) {
    getMountDir(consortiumId: $consortiumId)
  }
`

export const EDGE_SET_MOUNT_DIR_MUTATION = `
  mutation setMountDir($consortiumId: String, $mountDir: String) {
    setMountDir(consortiumId: $consortiumId, mountDir: $mountDir)
  }
`

export const EDGE_GET_LOCAL_PARAMS_QUERY = `
  query getLocalParams($consortiumId: String, $mountDir: String) {
    getLocalParams(consortiumId: $consortiumId, mountDir: $mountDir)
  }
`

export const EDGE_SET_LOCAL_PARAMS_MUTATION = `
  mutation setLocalParams($consortiumId: String, $mountDir: String, $localParams: String) {
    setLocalParams(consortiumId: $consortiumId, mountDir: $mountDir, localParams: $localParams)
  }
`

// Establishes the edge client's live subscription to centralApi's
// runStartEdge (see edgeFederatedClient's resolvers.ts) — without this, the
// edge client never picks up runs for this identity, even if its mount
// directory is set and the consortium member is marked ready. The GUI does
// this implicitly as part of its own login flow; a CLI session logging in
// separately does not, so it must be called explicitly.
export const EDGE_CONNECT_AS_USER_MUTATION = `
  mutation {
    connectAsUser
  }
`
