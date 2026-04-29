export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
};

export type Computation = {
  __typename?: 'Computation';
  hasLocalParameters: Scalars['Boolean']['output'];
  imageDownloadUrl: Scalars['String']['output'];
  imageName: Scalars['String']['output'];
  notes: Scalars['String']['output'];
  owner: Scalars['String']['output'];
  title: Scalars['String']['output'];
};

export type ComputationListItem = {
  __typename?: 'ComputationListItem';
  id: Scalars['String']['output'];
  imageName: Scalars['String']['output'];
  title: Scalars['String']['output'];
};

export type ConsortiumDetails = {
  __typename?: 'ConsortiumDetails';
  activeMembers: Array<PublicUser>;
  activeVaultMembers: Array<HostedVault>;
  description: Scalars['String']['output'];
  id: Scalars['String']['output'];
  isPrivate: Scalars['Boolean']['output'];
  leader: PublicUser;
  members: Array<PublicUser>;
  readyMembers: Array<PublicUser>;
  readyVaultMembers: Array<HostedVault>;
  studyConfiguration: StudyConfiguration;
  title: Scalars['String']['output'];
  vaultMembers: Array<HostedVault>;
};

export type ConsortiumListItem = {
  __typename?: 'ConsortiumListItem';
  description: Scalars['String']['output'];
  id: Scalars['String']['output'];
  isPrivate: Scalars['Boolean']['output'];
  leader: PublicUser;
  members: Array<PublicUser>;
  title: Scalars['String']['output'];
};

export type HostedVault = {
  __typename?: 'HostedVault';
  active: Scalars['Boolean']['output'];
  allowedComputations: Array<ComputationListItem>;
  datasetKey: Scalars['String']['output'];
  description: Scalars['String']['output'];
  id: Scalars['String']['output'];
  name: Scalars['String']['output'];
  serverId: Scalars['String']['output'];
};

export type InviteInfo = {
  __typename?: 'InviteInfo';
  consortiumName: Scalars['String']['output'];
  isExpired: Scalars['Boolean']['output'];
  leaderName: Scalars['String']['output'];
};

export type LoginOutput = {
  __typename?: 'LoginOutput';
  accessToken: Scalars['String']['output'];
  roles: Array<Scalars['String']['output']>;
  userId: Scalars['String']['output'];
  username: Scalars['String']['output'];
};

export type Mutation = {
  __typename?: 'Mutation';
  adminChangeUserPassword: Scalars['Boolean']['output'];
  adminChangeUserRoles: Scalars['Boolean']['output'];
  adminCreateHostedVault: Scalars['String']['output'];
  adminSetHostedVaultAllowedComputations: Scalars['Boolean']['output'];
  adminSetVaultAllowedComputations: Scalars['Boolean']['output'];
  adminSetVaultDatasetMappings: Scalars['Boolean']['output'];
  computationCreate: Scalars['Boolean']['output'];
  computationEdit: Scalars['Boolean']['output'];
  consortiumCreate: Scalars['String']['output'];
  consortiumDelete: Scalars['Boolean']['output'];
  consortiumEdit: Scalars['Boolean']['output'];
  consortiumInvite: Scalars['Boolean']['output'];
  consortiumJoin: Scalars['Boolean']['output'];
  consortiumJoinByInvite: Scalars['Boolean']['output'];
  consortiumLeave: Scalars['Boolean']['output'];
  consortiumSetMemberActive: Scalars['Boolean']['output'];
  consortiumSetMemberReady: Scalars['Boolean']['output'];
  leaderAddHostedVault: Scalars['Boolean']['output'];
  leaderAddVaultUser: Scalars['Boolean']['output'];
  leaderRemoveHostedVault: Scalars['Boolean']['output'];
  leaderRemoveMember: Scalars['Boolean']['output'];
  leaderSetHostedVaultActive: Scalars['Boolean']['output'];
  leaderSetMemberInactive: Scalars['Boolean']['output'];
  login: LoginOutput;
  reportRunComplete: Scalars['Boolean']['output'];
  reportRunError: Scalars['Boolean']['output'];
  reportRunReady: Scalars['Boolean']['output'];
  reportRunStatus: Scalars['Boolean']['output'];
  requestPasswordReset: Scalars['Boolean']['output'];
  resetPassword: LoginOutput;
  runDelete: Scalars['Boolean']['output'];
  startRun: StartRunOutput;
  studySetComputation: Scalars['Boolean']['output'];
  studySetNotes: Scalars['Boolean']['output'];
  studySetParameters: Scalars['Boolean']['output'];
  userChangePassword: Scalars['Boolean']['output'];
  userCreate: LoginOutput;
  vaultHeartbeat: Scalars['Boolean']['output'];
};


export type MutationAdminChangeUserPasswordArgs = {
  password: Scalars['String']['input'];
  username: Scalars['String']['input'];
};


export type MutationAdminChangeUserRolesArgs = {
  roles: Array<Scalars['String']['input']>;
  username: Scalars['String']['input'];
};


export type MutationAdminCreateHostedVaultArgs = {
  datasetKey: Scalars['String']['input'];
  description: Scalars['String']['input'];
  name: Scalars['String']['input'];
  serverId: Scalars['String']['input'];
};


export type MutationAdminSetHostedVaultAllowedComputationsArgs = {
  computationIds: Array<Scalars['String']['input']>;
  vaultId: Scalars['String']['input'];
};


export type MutationAdminSetVaultAllowedComputationsArgs = {
  computationIds: Array<Scalars['String']['input']>;
  userId: Scalars['String']['input'];
};


export type MutationAdminSetVaultDatasetMappingsArgs = {
  mappings: Array<VaultDatasetMappingInput>;
  userId: Scalars['String']['input'];
};


export type MutationComputationCreateArgs = {
  hasLocalParameters: Scalars['Boolean']['input'];
  imageDownloadUrl: Scalars['String']['input'];
  imageName: Scalars['String']['input'];
  notes: Scalars['String']['input'];
  title: Scalars['String']['input'];
};


export type MutationComputationEditArgs = {
  computationId: Scalars['String']['input'];
  hasLocalParameters: Scalars['Boolean']['input'];
  imageDownloadUrl: Scalars['String']['input'];
  imageName: Scalars['String']['input'];
  notes: Scalars['String']['input'];
  title: Scalars['String']['input'];
};


export type MutationConsortiumCreateArgs = {
  description?: InputMaybe<Scalars['String']['input']>;
  isPrivate?: InputMaybe<Scalars['Boolean']['input']>;
  title: Scalars['String']['input'];
};


export type MutationConsortiumDeleteArgs = {
  consortiumId: Scalars['String']['input'];
};


export type MutationConsortiumEditArgs = {
  consortiumId: Scalars['String']['input'];
  description: Scalars['String']['input'];
  isPrivate?: InputMaybe<Scalars['Boolean']['input']>;
  title: Scalars['String']['input'];
};


export type MutationConsortiumInviteArgs = {
  consortiumId: Scalars['String']['input'];
  email: Scalars['String']['input'];
};


export type MutationConsortiumJoinArgs = {
  consortiumId: Scalars['String']['input'];
};


export type MutationConsortiumJoinByInviteArgs = {
  inviteToken: Scalars['String']['input'];
};


export type MutationConsortiumLeaveArgs = {
  consortiumId: Scalars['String']['input'];
};


export type MutationConsortiumSetMemberActiveArgs = {
  active: Scalars['Boolean']['input'];
  consortiumId: Scalars['String']['input'];
};


export type MutationConsortiumSetMemberReadyArgs = {
  consortiumId: Scalars['String']['input'];
  ready: Scalars['Boolean']['input'];
};


export type MutationLeaderAddHostedVaultArgs = {
  consortiumId: Scalars['String']['input'];
  vaultId: Scalars['String']['input'];
};


export type MutationLeaderAddVaultUserArgs = {
  consortiumId: Scalars['String']['input'];
  userId: Scalars['String']['input'];
};


export type MutationLeaderRemoveHostedVaultArgs = {
  consortiumId: Scalars['String']['input'];
  vaultId: Scalars['String']['input'];
};


export type MutationLeaderRemoveMemberArgs = {
  consortiumId: Scalars['String']['input'];
  userId: Scalars['String']['input'];
};


export type MutationLeaderSetHostedVaultActiveArgs = {
  active: Scalars['Boolean']['input'];
  consortiumId: Scalars['String']['input'];
  vaultId: Scalars['String']['input'];
};


export type MutationLeaderSetMemberInactiveArgs = {
  active: Scalars['Boolean']['input'];
  consortiumId: Scalars['String']['input'];
  userId: Scalars['String']['input'];
};


export type MutationLoginArgs = {
  password: Scalars['String']['input'];
  username: Scalars['String']['input'];
};


export type MutationReportRunCompleteArgs = {
  runId: Scalars['String']['input'];
};


export type MutationReportRunErrorArgs = {
  errorMessage: Scalars['String']['input'];
  runId: Scalars['String']['input'];
};


export type MutationReportRunReadyArgs = {
  runId: Scalars['String']['input'];
};


export type MutationReportRunStatusArgs = {
  runId: Scalars['String']['input'];
  status: Scalars['String']['input'];
};


export type MutationRequestPasswordResetArgs = {
  username: Scalars['String']['input'];
};


export type MutationResetPasswordArgs = {
  newPassword: Scalars['String']['input'];
  token: Scalars['String']['input'];
};


export type MutationRunDeleteArgs = {
  runId: Scalars['String']['input'];
};


export type MutationStartRunArgs = {
  input: StartRunInput;
};


export type MutationStudySetComputationArgs = {
  computationId: Scalars['String']['input'];
  consortiumId: Scalars['String']['input'];
};


export type MutationStudySetNotesArgs = {
  consortiumId: Scalars['String']['input'];
  notes: Scalars['String']['input'];
};


export type MutationStudySetParametersArgs = {
  consortiumId: Scalars['String']['input'];
  parameters: Scalars['String']['input'];
};


export type MutationUserChangePasswordArgs = {
  password: Scalars['String']['input'];
};


export type MutationUserCreateArgs = {
  password: Scalars['String']['input'];
  username: Scalars['String']['input'];
};


export type MutationVaultHeartbeatArgs = {
  heartbeat: VaultHeartbeatInput;
};

export type PublicUser = {
  __typename?: 'PublicUser';
  id: Scalars['String']['output'];
  username: Scalars['String']['output'];
  vault?: Maybe<Vault>;
  vaultStatus?: Maybe<VaultStatus>;
};

export type Query = {
  __typename?: 'Query';
  getComputationDetails: Computation;
  getComputationList: Array<ComputationListItem>;
  getConsortiumDetails: ConsortiumDetails;
  getConsortiumList: Array<ConsortiumListItem>;
  getHostedVaultList: Array<HostedVault>;
  getInviteInfo: InviteInfo;
  getMyVaultConfig: Vault;
  getMyVaultServerConfig: VaultServer;
  getRunDetails: RunDetails;
  getRunList: Array<RunListItem>;
  getUserProfile: UserProfile;
  getVaultServerList: Array<VaultServer>;
  getVaultUserList: Array<PublicUser>;
};


export type QueryGetComputationDetailsArgs = {
  computationId: Scalars['String']['input'];
};


export type QueryGetConsortiumDetailsArgs = {
  consortiumId: Scalars['String']['input'];
};


export type QueryGetHostedVaultListArgs = {
  serverId?: InputMaybe<Scalars['String']['input']>;
};


export type QueryGetInviteInfoArgs = {
  inviteToken: Scalars['String']['input'];
};


export type QueryGetRunDetailsArgs = {
  runId: Scalars['String']['input'];
};


export type QueryGetRunListArgs = {
  consortiumId?: InputMaybe<Scalars['String']['input']>;
};

export type RunDetailConsortium = {
  __typename?: 'RunDetailConsortium';
  activeMembers: Array<PublicUser>;
  activeVaultMembers: Array<HostedVault>;
  id: Scalars['String']['output'];
  leader: PublicUser;
  readyMembers: Array<PublicUser>;
  readyVaultMembers: Array<HostedVault>;
  title: Scalars['String']['output'];
};

export type RunDetails = {
  __typename?: 'RunDetails';
  consortium: RunDetailConsortium;
  createdAt: Scalars['String']['output'];
  lastUpdated: Scalars['String']['output'];
  members: Array<PublicUser>;
  runErrors: Array<RunError>;
  runId: Scalars['String']['output'];
  status: Scalars['String']['output'];
  studyConfiguration: StudyConfiguration;
  vaultMembers: Array<HostedVault>;
};

export type RunError = {
  __typename?: 'RunError';
  message: Scalars['String']['output'];
  timestamp: Scalars['String']['output'];
  user: PublicUser;
};

export type RunEventPayload = {
  __typename?: 'RunEventPayload';
  consortiumId: Scalars['String']['output'];
  consortiumTitle: Scalars['String']['output'];
  runId: Scalars['String']['output'];
  status: Scalars['String']['output'];
  timestamp: Scalars['String']['output'];
};

export type RunListItem = {
  __typename?: 'RunListItem';
  consortiumId: Scalars['String']['output'];
  consortiumTitle: Scalars['String']['output'];
  createdAt: Scalars['String']['output'];
  lastUpdated: Scalars['String']['output'];
  runId: Scalars['String']['output'];
  status: Scalars['String']['output'];
};

export type RunStartCentralPayload = {
  __typename?: 'RunStartCentralPayload';
  computationParameters: Scalars['String']['output'];
  consortiumId: Scalars['String']['output'];
  imageName: Scalars['String']['output'];
  participantIds: Array<Scalars['String']['output']>;
  runId: Scalars['String']['output'];
  users: Array<UserIdNamePair>;
};

export type RunStartEdgePayload = {
  __typename?: 'RunStartEdgePayload';
  computationId: Scalars['String']['output'];
  consortiumId: Scalars['String']['output'];
  downloadToken: Scalars['String']['output'];
  downloadUrl: Scalars['String']['output'];
  imageName: Scalars['String']['output'];
  participantId: Scalars['String']['output'];
  runId: Scalars['String']['output'];
  vaultId?: Maybe<Scalars['String']['output']>;
};

export type StartRunInput = {
  consortiumId: Scalars['String']['input'];
};

export type StartRunOutput = {
  __typename?: 'StartRunOutput';
  runId: Scalars['String']['output'];
};

export type StudyConfiguration = {
  __typename?: 'StudyConfiguration';
  computation?: Maybe<Computation>;
  computationParameters: Scalars['String']['output'];
  consortiumLeaderNotes?: Maybe<Scalars['String']['output']>;
};

export type Subscription = {
  __typename?: 'Subscription';
  consortiumDetailsChanged: Scalars['String']['output'];
  consortiumLatestRunChanged: Scalars['String']['output'];
  runDetailsChanged: Scalars['String']['output'];
  runEvent: RunEventPayload;
  runStartCentral: RunStartCentralPayload;
  runStartEdge: RunStartEdgePayload;
};


export type SubscriptionConsortiumDetailsChangedArgs = {
  consortiumId: Scalars['String']['input'];
};


export type SubscriptionConsortiumLatestRunChangedArgs = {
  consortiumId: Scalars['String']['input'];
};


export type SubscriptionRunDetailsChangedArgs = {
  runId: Scalars['String']['input'];
};

export type UserProfile = {
  __typename?: 'UserProfile';
  roles: Array<Scalars['String']['output']>;
  userId: Scalars['String']['output'];
  username: Scalars['String']['output'];
};

export type UserIdNamePair = {
  __typename?: 'UserIdNamePair';
  id: Scalars['String']['output'];
  name: Scalars['String']['output'];
};

export type Vault = {
  __typename?: 'Vault';
  allowedComputations: Array<ComputationListItem>;
  datasetMappings: Array<VaultDatasetMapping>;
  description: Scalars['String']['output'];
  name: Scalars['String']['output'];
};

export type VaultDataset = {
  __typename?: 'VaultDataset';
  key: Scalars['String']['output'];
  label?: Maybe<Scalars['String']['output']>;
  path: Scalars['String']['output'];
};

export type VaultDatasetInput = {
  key: Scalars['String']['input'];
  label?: InputMaybe<Scalars['String']['input']>;
  path: Scalars['String']['input'];
};

export type VaultDatasetMapping = {
  __typename?: 'VaultDatasetMapping';
  computationId: Scalars['String']['output'];
  datasetKey: Scalars['String']['output'];
};

export type VaultDatasetMappingInput = {
  computationId: Scalars['String']['input'];
  datasetKey: Scalars['String']['input'];
};

export type VaultHeartbeatInput = {
  availableDatasets: Array<VaultDatasetInput>;
  runningComputations: Array<VaultRunningComputationInput>;
  status: Scalars['String']['input'];
  uptime: Scalars['Int']['input'];
  version: Scalars['String']['input'];
  websocketConnected: Scalars['Boolean']['input'];
};

export type VaultRunningComputation = {
  __typename?: 'VaultRunningComputation';
  consortiumId: Scalars['String']['output'];
  consortiumTitle?: Maybe<Scalars['String']['output']>;
  runId: Scalars['String']['output'];
  runStartedAt: Scalars['String']['output'];
  runningFor: Scalars['Int']['output'];
};

export type VaultRunningComputationInput = {
  consortiumId: Scalars['String']['input'];
  runId: Scalars['String']['input'];
  startedAt: Scalars['String']['input'];
};

export type VaultServer = {
  __typename?: 'VaultServer';
  description: Scalars['String']['output'];
  id: Scalars['String']['output'];
  name: Scalars['String']['output'];
  status?: Maybe<VaultStatus>;
  userId: Scalars['String']['output'];
  username: Scalars['String']['output'];
  vaults: Array<HostedVault>;
};

export type VaultStatus = {
  __typename?: 'VaultStatus';
  availableDatasets: Array<VaultDataset>;
  lastHeartbeat: Scalars['String']['output'];
  runningComputations: Array<VaultRunningComputation>;
  status: Scalars['String']['output'];
  uptime: Scalars['Int']['output'];
  version: Scalars['String']['output'];
  websocketConnected: Scalars['Boolean']['output'];
};
